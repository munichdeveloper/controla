package de.atstck.controla.testing;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Stateful stand-in for the parts of the n8n public API that Controla uses, so monitoring, alerts,
 * export, import and instance limits can be tested without real n8n containers.
 *
 * <p>One server simulates any number of instances under {@code /i/{name}}; the base URL of an instance
 * is {@link Instance#baseUrl()}. Behaviour follows n8n 1.x where Controla depends on it: API key in
 * {@code X-N8N-API-KEY} (401 otherwise), cursor pagination with a default page size of 100 and a
 * maximum of 250, string ids, and a workflow create endpoint that rejects read-only or unknown fields.
 * Where this differs from a real n8n, the real n8n wins; the contract test is the reference.
 *
 * <p>Test control, also available over HTTP for a running sandbox (see {@link #main(String[])}):
 * <pre>
 *   POST /__control/{name}                     create the instance (body optional: {"apiKey": "...", "version": "..."})
 *   POST /__control/{name}/down?mode=drop|502|503   simulate an outage (drop = connection closed, reads as offline)
 *   POST /__control/{name}/up                  end the outage
 *   POST /__control/{name}/api-key             body {"apiKey": "..."}: rotate the key, the old one gets 401
 *   POST /__control/{name}/error-execution     body {"workflowId": "...", "message": "...", "startedAt": "..."}
 *   GET  /__control/{name}/workflows           all stored workflows (for restore comparisons)
 *   POST /__control/{name}/reset               remove workflows and executions, end outages
 *   GET  /__control                            names of all instances
 * </pre>
 */
public final class FakeN8n implements AutoCloseable {

    /** Default and maximum page size of the n8n public API. */
    static final int DEFAULT_LIMIT = 100;
    static final int MAX_LIMIT = 250;
    /** Fields the n8n public API accepts when creating a workflow; anything else is rejected. */
    static final Set<String> WORKFLOW_CREATE_FIELDS = Set.of("name", "nodes", "connections", "settings", "staticData");

    public enum DownMode { DROP, BAD_GATEWAY, UNAVAILABLE }

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    private final HttpServer server;
    private final String host;
    private final Map<String, Instance> instances = new ConcurrentHashMap<>();
    private volatile String publicRootUrl;

    private FakeN8n(String bindAddress, int port) throws IOException {
        InetAddress address = InetAddress.getByName(bindAddress);
        server = HttpServer.create(new InetSocketAddress(address, port), 0);
        server.createContext("/", this::handle);
        server.setExecutor(Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "fake-n8n");
            t.setDaemon(true);
            return t;
        }));
        server.start();
        host = address.isAnyLocalAddress() ? "127.0.0.1" : address.getHostAddress();
    }

    /** Starts on 127.0.0.1 with a free port. */
    public static FakeN8n start() throws IOException {
        return new FakeN8n("127.0.0.1", 0);
    }

    public static FakeN8n start(String bindAddress, int port) throws IOException {
        return new FakeN8n(bindAddress, port);
    }

    /**
     * Runs the fake as a standalone process, e.g. in a Docker Compose sandbox.
     * Arguments: {@code [port] [bindAddress]}, defaults 5678 and 0.0.0.0. Instances listed in the
     * environment variable {@code FAKE_N8N_INSTANCES} (comma-separated names) are created at start;
     * their API key is {@code fake-key-<name>}. {@code FAKE_N8N_PUBLIC_URL} (e.g. {@code http://fake-n8n:5678})
     * sets the root that {@link Instance#baseUrl()} reports, for use inside a Docker network.
     */
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 5678;
        String bind = args.length > 1 ? args[1] : "0.0.0.0";
        FakeN8n fake = start(bind, port);
        String publicUrl = System.getenv("FAKE_N8N_PUBLIC_URL");
        if (publicUrl != null && !publicUrl.isBlank()) fake.publicRootUrl(publicUrl);
        String preset = System.getenv("FAKE_N8N_INSTANCES");
        if (preset != null) {
            for (String name : preset.split(",")) {
                if (!name.isBlank()) fake.instance(name.strip());
            }
        }
        System.out.println("fake-n8n listening on " + bind + ":" + fake.port());
        Thread.currentThread().join();
    }

    public int port() {
        return server.getAddress().getPort();
    }

    /** Server root, e.g. {@code http://127.0.0.1:5678}, or the public URL if one was set. */
    public String rootUrl() {
        return publicRootUrl != null ? publicRootUrl : "http://" + host + ":" + port();
    }

    /** Root URL other containers use to reach this server; only changes what {@link Instance#baseUrl()} reports. */
    public FakeN8n publicRootUrl(String url) {
        this.publicRootUrl = url.replaceAll("/$", "");
        return this;
    }

    /** Returns the instance with this name, creating it with API key {@code fake-key-<name>} if needed. */
    public Instance instance(String name) {
        if (!name.matches("[A-Za-z0-9_.-]+")) throw new IllegalArgumentException("Invalid instance name: " + name);
        return instances.computeIfAbsent(name, Instance::new);
    }

    @Override
    public void close() {
        server.stop(0);
    }

    /** One simulated n8n instance. All methods are thread-safe. */
    public final class Instance {
        private final String name;
        private final Map<String, Map<String, Object>> workflows = new LinkedHashMap<>();
        private final List<Map<String, Object>> executions = new ArrayList<>();
        private final AtomicLong executionIds = new AtomicLong(1000);
        private volatile String apiKey;
        private volatile String version = "1.70.0";
        private volatile DownMode down;

        private Instance(String name) {
            this.name = name;
            this.apiKey = "fake-key-" + name;
        }

        public String name() {
            return name;
        }

        public String baseUrl() {
            return rootUrl() + "/i/" + name;
        }

        public String apiKey() {
            return apiKey;
        }

        /** Rotates the API key; requests with the previous key get 401 from now on. */
        public Instance apiKey(String newKey) {
            this.apiKey = newKey;
            return this;
        }

        public Instance version(String newVersion) {
            this.version = newVersion;
            return this;
        }

        /** Simulates a stopped container: the connection is closed without a response. */
        public Instance down() {
            return down(DownMode.DROP);
        }

        public Instance down(DownMode mode) {
            this.down = mode;
            return this;
        }

        public Instance up() {
            this.down = null;
            return this;
        }

        public boolean isDown() {
            return down != null;
        }

        /** Stores a workflow as if created through the API and returns its id. */
        public synchronized String addWorkflow(String workflowName) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("name", workflowName);
            body.put("nodes", List.of(Map.of("id", "n1", "name", "Start", "type", "n8n-nodes-base.manualTrigger",
                    "typeVersion", 1, "position", List.of(0, 0), "parameters", Map.of())));
            body.put("connections", Map.of());
            body.put("settings", Map.of("executionOrder", "v1"));
            return createWorkflow(body);
        }

        /** Records a failed execution of a workflow; it appears in {@code /api/v1/executions?status=error}. */
        public synchronized String addErrorExecution(String workflowId, String message, Instant startedAt) {
            return addExecution(workflowId, "error", message, startedAt);
        }

        public synchronized String addSuccessExecution(String workflowId, Instant startedAt) {
            return addExecution(workflowId, "success", null, startedAt);
        }

        /** Copies of all stored workflows in creation order. */
        public synchronized List<Map<String, Object>> workflows() {
            return workflows.values().stream().map(LinkedHashMap::new).map(m -> (Map<String, Object>) m).toList();
        }

        public synchronized void reset() {
            workflows.clear();
            executions.clear();
            down = null;
        }

        private synchronized String createWorkflow(Map<String, Object> body) {
            String id = newId();
            String now = Instant.now().toString();
            Map<String, Object> wf = new LinkedHashMap<>();
            wf.put("id", id);
            wf.put("name", body.get("name"));
            wf.put("active", false);
            wf.put("createdAt", now);
            wf.put("updatedAt", now);
            wf.put("nodes", body.get("nodes"));
            wf.put("connections", body.get("connections"));
            wf.put("settings", body.getOrDefault("settings", Map.of()));
            wf.put("staticData", body.get("staticData"));
            wf.put("tags", List.of());
            workflows.put(id, wf);
            return id;
        }

        private String addExecution(String workflowId, String status, String message, Instant startedAt) {
            String id = String.valueOf(executionIds.incrementAndGet());
            Instant started = startedAt != null ? startedAt : Instant.now();
            Map<String, Object> exec = new LinkedHashMap<>();
            exec.put("id", id);
            exec.put("finished", "success".equals(status));
            exec.put("mode", "trigger");
            exec.put("retryOf", null);
            exec.put("retrySuccessId", null);
            exec.put("status", status);
            exec.put("startedAt", started.toString());
            exec.put("stoppedAt", started.plusMillis(250).toString());
            exec.put("workflowId", workflowId);
            exec.put("waitTill", null);
            if (message != null) exec.put("_errorMessage", message);
            executions.add(exec);
            return id;
        }
    }

    // ---------------------------------------------------------------- HTTP

    private void handle(HttpExchange exchange) throws IOException {
        try {
            String path = exchange.getRequestURI().getRawPath();
            if (path.startsWith("/__control")) {
                handleControl(exchange, path.substring("/__control".length()));
                return;
            }
            if (!path.startsWith("/i/")) {
                send(exchange, 404, Map.of("message", "not found"));
                return;
            }
            String rest = path.substring(3);
            int slash = rest.indexOf('/');
            String name = slash < 0 ? rest : rest.substring(0, slash);
            String subPath = slash < 0 ? "/" : rest.substring(slash);
            Instance instance = instances.get(name);
            if (instance == null) {
                exchange.close();  // unknown host: nothing listens there
                return;
            }
            DownMode down = instance.down;
            if (down == DownMode.DROP) {
                dropConnection(exchange);
                return;
            }
            if (down != null) {
                int status = down == DownMode.BAD_GATEWAY ? 502 : 503;
                sendText(exchange, status, "text/html", "<html><body>" + status + "</body></html>");
                return;
            }
            handleInstance(exchange, instance, subPath);
        } catch (Exception e) {
            send(exchange, 500, Map.of("message", String.valueOf(e.getMessage())));
        }
    }

    private void handleInstance(HttpExchange exchange, Instance instance, String path) throws IOException {
        String method = exchange.getRequestMethod();
        if (path.equals("/") || path.isEmpty()) {
            sendText(exchange, 200, "text/html", "<!DOCTYPE html><html><head><script>window.n8nVersion = '"
                    + instance.version + "';</script></head><body>n8n</body></html>");
            return;
        }
        if (path.equals("/healthz") || path.equals("/healthz/readiness")) {
            send(exchange, 200, Map.of("status", "ok"));
            return;
        }
        if (!path.startsWith("/api/v1/")) {
            send(exchange, 404, Map.of("message", "not found"));
            return;
        }
        String key = exchange.getRequestHeaders().getFirst("X-N8N-API-KEY");
        if (key == null || !key.equals(instance.apiKey)) {
            send(exchange, 401, Map.of("message", "unauthorized"));
            return;
        }
        Map<String, String> query = query(exchange);
        String resource = path.substring("/api/v1".length());
        if (resource.equals("/users") && method.equals("GET")) {
            sendPage(exchange, List.of(Map.of("id", "1", "email", "owner@fake-n8n.invalid", "firstName", "Fake",
                    "lastName", "Owner", "isPending", false, "role", "global:owner")), query);
        } else if (resource.equals("/workflows") && method.equals("GET")) {
            List<Map<String, Object>> all;
            synchronized (instance) {
                all = new ArrayList<>(instance.workflows.values());
            }
            sendPage(exchange, all, query);
        } else if (resource.equals("/workflows") && method.equals("POST")) {
            createWorkflow(exchange, instance);
        } else if (resource.startsWith("/workflows/") && method.equals("GET")) {
            Map<String, Object> wf;
            synchronized (instance) {
                wf = instance.workflows.get(resource.substring("/workflows/".length()));
            }
            if (wf == null) send(exchange, 404, Map.of("message", "Not Found"));
            else send(exchange, 200, wf);
        } else if (resource.equals("/executions") && method.equals("GET")) {
            listExecutions(exchange, instance, query);
        } else {
            send(exchange, 404, Map.of("message", "not found"));
        }
    }

    private void createWorkflow(HttpExchange exchange, Instance instance) throws IOException {
        Map<String, Object> body;
        try (InputStream in = exchange.getRequestBody()) {
            body = JSON.readValue(in, new TypeReference<>() { });
        } catch (Exception e) {
            send(exchange, 400, Map.of("message", "request/body must be object"));
            return;
        }
        for (String field : body.keySet()) {
            if (!WORKFLOW_CREATE_FIELDS.contains(field)) {
                send(exchange, 400, Map.of("message", "request/body must NOT have additional properties"));
                return;
            }
        }
        for (String required : List.of("name", "nodes", "connections", "settings")) {
            if (!body.containsKey(required)) {
                send(exchange, 400, Map.of("message", "request/body must have required property '" + required + "'"));
                return;
            }
        }
        String id = instance.createWorkflow(body);
        Map<String, Object> created;
        synchronized (instance) {
            created = instance.workflows.get(id);
        }
        send(exchange, 200, created);
    }

    private void listExecutions(HttpExchange exchange, Instance instance, Map<String, String> query) throws IOException {
        String status = query.get("status");
        String workflowId = query.get("workflowId");
        boolean includeData = "true".equals(query.get("includeData"));
        List<Map<String, Object>> result = new ArrayList<>();
        synchronized (instance) {
            for (Map<String, Object> exec : instance.executions) {
                if (status != null && !status.equals(exec.get("status"))) continue;
                if (workflowId != null && !workflowId.equals(exec.get("workflowId"))) continue;
                Map<String, Object> copy = new LinkedHashMap<>(exec);
                Object message = copy.remove("_errorMessage");
                if (includeData) {
                    Map<String, Object> wf = instance.workflows.get(String.valueOf(exec.get("workflowId")));
                    Map<String, Object> resultData = new LinkedHashMap<>();
                    resultData.put("runData", Map.of());
                    if (message != null) {
                        resultData.put("error", Map.of("message", message, "name", "NodeOperationError"));
                    }
                    copy.put("data", Map.of("resultData", resultData));
                    if (wf != null) copy.put("workflowData", Map.of("id", wf.get("id"), "name", wf.get("name")));
                }
                result.add(copy);
            }
        }
        // n8n returns the newest executions first
        result.sort(Comparator.comparing((Map<String, Object> e) -> String.valueOf(e.get("startedAt"))).reversed());
        sendPage(exchange, result, query);
    }

    private void sendPage(HttpExchange exchange, List<Map<String, Object>> all, Map<String, String> query) throws IOException {
        int limit = DEFAULT_LIMIT;
        if (query.containsKey("limit")) {
            try {
                limit = Integer.parseInt(query.get("limit"));
            } catch (NumberFormatException e) {
                send(exchange, 400, Map.of("message", "request/query/limit must be integer"));
                return;
            }
            if (limit < 1 || limit > MAX_LIMIT) {
                send(exchange, 400, Map.of("message", "request/query/limit must be <= " + MAX_LIMIT));
                return;
            }
        }
        int offset = 0;
        if (query.containsKey("cursor")) {
            try {
                offset = Integer.parseInt(new String(Base64.getDecoder().decode(query.get("cursor")), StandardCharsets.UTF_8));
            } catch (IllegalArgumentException e) {
                send(exchange, 400, Map.of("message", "invalid cursor"));
                return;
            }
        }
        int end = Math.min(all.size(), offset + limit);
        List<Map<String, Object>> page = offset >= all.size() ? List.of() : all.subList(offset, end);
        String next = end < all.size()
                ? Base64.getEncoder().encodeToString(String.valueOf(end).getBytes(StandardCharsets.UTF_8)) : null;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("data", page);
        body.put("nextCursor", next);
        send(exchange, 200, body);
    }

    private void handleControl(HttpExchange exchange, String path) throws IOException {
        String method = exchange.getRequestMethod();
        String[] parts = path.replaceFirst("^/", "").split("/");
        if (parts.length == 1 && parts[0].isEmpty()) {
            send(exchange, 200, Map.of("instances", new ArrayList<>(instances.keySet())));
            return;
        }
        String name = parts[0];
        String action = parts.length > 1 ? parts[1] : "";
        Map<String, Object> body = readOptionalBody(exchange);
        if (action.isEmpty() && method.equals("POST")) {
            Instance instance = instance(name);
            if (body.get("apiKey") instanceof String k) instance.apiKey(k);
            if (body.get("version") instanceof String v) instance.version(v);
            send(exchange, 200, describe(instance));
            return;
        }
        Instance instance = instances.get(name);
        if (instance == null) {
            send(exchange, 404, Map.of("message", "unknown instance " + name));
            return;
        }
        switch (action) {
            case "" -> send(exchange, 200, describe(instance));
            case "down" -> {
                String mode = query(exchange).getOrDefault("mode", "drop");
                instance.down(switch (mode) {
                    case "502" -> DownMode.BAD_GATEWAY;
                    case "503" -> DownMode.UNAVAILABLE;
                    default -> DownMode.DROP;
                });
                send(exchange, 200, describe(instance));
            }
            case "up" -> send(exchange, 200, describe(instance.up()));
            case "api-key" -> {
                if (!(body.get("apiKey") instanceof String k)) {
                    send(exchange, 400, Map.of("message", "apiKey required"));
                    return;
                }
                send(exchange, 200, describe(instance.apiKey(k)));
            }
            case "error-execution" -> {
                String workflowId = body.get("workflowId") instanceof String w ? w : null;
                if (workflowId == null) {
                    List<Map<String, Object>> wfs = instance.workflows();
                    workflowId = wfs.isEmpty() ? instance.addWorkflow("Failing test workflow")
                            : String.valueOf(wfs.get(0).get("id"));
                }
                String message = body.get("message") instanceof String m ? m : "Simulated node error";
                Instant startedAt = body.get("startedAt") instanceof String s ? Instant.parse(s) : Instant.now();
                String id = instance.addErrorExecution(workflowId, message, startedAt);
                send(exchange, 200, Map.of("executionId", id, "workflowId", workflowId));
            }
            case "workflow" -> {
                String workflowName = body.get("name") instanceof String n ? n : "Test workflow";
                send(exchange, 200, Map.of("id", instance.addWorkflow(workflowName)));
            }
            case "workflows" -> send(exchange, 200, Map.of("data", instance.workflows()));
            case "reset" -> {
                instance.reset();
                send(exchange, 200, describe(instance));
            }
            default -> send(exchange, 404, Map.of("message", "unknown action " + action));
        }
    }

    private static Map<String, Object> describe(Instance instance) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("name", instance.name);
        d.put("baseUrl", instance.baseUrl());
        d.put("apiKey", instance.apiKey);
        d.put("version", instance.version);
        d.put("down", instance.down == null ? null : instance.down.name());
        synchronized (instance) {
            d.put("workflows", instance.workflows.size());
            d.put("executions", instance.executions.size());
        }
        return d;
    }

    private static Map<String, Object> readOptionalBody(HttpExchange exchange) throws IOException {
        try (InputStream in = exchange.getRequestBody()) {
            byte[] bytes = in.readAllBytes();
            if (bytes.length == 0) return Map.of();
            return JSON.readValue(bytes, new TypeReference<>() { });
        }
    }

    private static Map<String, String> query(HttpExchange exchange) {
        Map<String, String> result = new LinkedHashMap<>();
        String raw = exchange.getRequestURI().getRawQuery();
        if (raw == null) return result;
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            String k = URLDecoder.decode(eq < 0 ? pair : pair.substring(0, eq), StandardCharsets.UTF_8);
            String v = eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
            result.put(k, v);
        }
        return result;
    }

    private static void dropConnection(HttpExchange exchange) {
        // Closing without sending headers makes the HTTP client see a closed connection, like a stopped container.
        exchange.close();
    }

    private static void send(HttpExchange exchange, int status, Object body) throws IOException {
        sendText(exchange, status, "application/json", JSON.writeValueAsString(body));
    }

    private static void sendText(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType + "; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
        if (bytes.length > 0) exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String newId() {
        StringBuilder sb = new StringBuilder(16);
        for (int i = 0; i < 16; i++) sb.append(ID_CHARS.charAt(RANDOM.nextInt(ID_CHARS.length())));
        return sb.toString();
    }
}
