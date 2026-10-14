package de.atstck.controla.diagnostics.checks;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** Minimal HTTP stub on 127.0.0.1 for check tests. */
public final class LocalHttpServer implements AutoCloseable {

    public record Response(int status, String body, Map<String, String> headers) {
        public static Response of(int status, String body) {
            return new Response(status, body, Map.of());
        }
    }

    private final HttpServer server;
    private final Map<String, Response> routes = new ConcurrentHashMap<>();
    public final List<Map<String, List<String>>> requestHeaders = new CopyOnWriteArrayList<>();

    public LocalHttpServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0), 0);
        server.createContext("/", this::handle);
        server.start();
    }

    public LocalHttpServer route(String pathAndQuery, Response response) {
        routes.put(pathAndQuery, response);
        return this;
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public int port() {
        return server.getAddress().getPort();
    }

    private void handle(HttpExchange exchange) throws IOException {
        requestHeaders.add(Map.copyOf(exchange.getRequestHeaders()));
        String key = exchange.getRequestURI().getRawPath()
                + (exchange.getRequestURI().getRawQuery() != null ? "?" + exchange.getRequestURI().getRawQuery() : "");
        Response response = routes.getOrDefault(key, Response.of(404, "not found"));
        response.headers().forEach((k, v) -> exchange.getResponseHeaders().add(k, v));
        byte[] body = response.body().getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(response.status(), body.length == 0 ? -1 : body.length);
        if (body.length > 0) {
            exchange.getResponseBody().write(body);
        }
        exchange.close();
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
