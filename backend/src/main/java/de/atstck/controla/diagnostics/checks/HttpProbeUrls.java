package de.atstck.controla.diagnostics.checks;

final class HttpProbeUrls {

    private HttpProbeUrls() {
    }

    static String join(String baseUrl, String path) {
        return baseUrl.replaceAll("/+$", "") + path;
    }
}
