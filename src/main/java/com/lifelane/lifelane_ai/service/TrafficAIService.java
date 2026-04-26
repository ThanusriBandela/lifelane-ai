package com.lifelane.lifelane_ai.service;

import com.lifelane.lifelane_ai.model.Route;
import com.lifelane.lifelane_ai.repository.RouteRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

@Service
public class TrafficAIService {

    private final RouteRepository repo;

    @Value("${groq.api.key}")
    private String groqApiKey;

    private Map<String, Integer> trafficData = new HashMap<>();

    public TrafficAIService(RouteRepository repo) {
        this.repo = repo;
    }

    // IoT simulation input — unchanged
    public void updateTraffic(String road, int level) {
        trafficData.put(road, level);
    }

    // Returns all 3 routes — now with Groq AI explanation on best route
    public List<Route> getLiveRoutes() {

        int r1 = trafficData.getOrDefault("R1", random());
        int r2 = trafficData.getOrDefault("R2", random());
        int r3 = trafficData.getOrDefault("R3", random());

        // Find best route index
        int minVal = Math.min(r1, Math.min(r2, r3));
        int bestIdx = (minVal == r1) ? 0 : (minVal == r2) ? 1 : 2;

        // Get Groq AI explanation for best route
        String aiExplanation = callGroqForBestRoute(r1, r2, r3, bestIdx + 1, false);

        List<Route> routes = new ArrayList<>();
        Route route1 = createRoute(r1);
        Route route2 = createRoute(r2);
        Route route3 = createRoute(r3);

        // Only set AI explanation on the best route
        if (bestIdx == 0) route1.setAiExplanation(aiExplanation);
        else if (bestIdx == 1) route2.setAiExplanation(aiExplanation);
        else route3.setAiExplanation(aiExplanation);

        routes.add(route1);
        routes.add(route2);
        routes.add(route3);

        repo.saveAll(routes);
        return routes;
    }

    // New method for best-route endpoint — called by frontend
    public Route getBestRoute(boolean emergency) {
        int r1 = trafficData.getOrDefault("R1", random());
        int r2 = trafficData.getOrDefault("R2", random());
        int r3 = trafficData.getOrDefault("R3", random());

        int minVal = Math.min(r1, Math.min(r2, r3));
        int bestIdx = (minVal == r1) ? 0 : (minVal == r2) ? 1 : 2;
        int[] scores = {r1, r2, r3};

        String aiExplanation = callGroqForBestRoute(r1, r2, r3, bestIdx + 1, emergency);
        Route best = createRoute(scores[bestIdx]);
        best.setAiExplanation(aiExplanation);

        repo.save(best);
        return best;
    }

    // Call Groq API with traffic data
    private String callGroqForBestRoute(int r1, int r2, int r3, int bestRoute, boolean emergency) {
        try {
            String mode = emergency ? "emergency vehicle (ambulance/fire truck)" : "normal user";
            String prompt = "You are a traffic AI assistant for LifeLane, a route suggestion app in Hyderabad, India. " +
                    "Traffic density scores (0=empty road, 100=fully jammed): " +
                    "Route 1=" + r1 + "%, Route 2=" + r2 + "%, Route 3=" + r3 + "%. " +
                    "Best route selected: Route " + bestRoute + ". Mode: " + mode + ". " +
                    "Current time: " + new java.util.Date() + ". " +
                    "Give a 1-2 sentence friendly explanation of why this route was selected. " +
                    (emergency ? "Mention that emergency priority corridor is active. " : "") +
                    "Be concise. Max 35 words. No formatting, plain text only.";

            String requestBody = "{"
                    + "\"model\":\"llama3-8b-8192\","
                    + "\"messages\":[{\"role\":\"user\",\"content\":\"" + escapeJson(prompt) + "\"}],"
                    + "\"max_tokens\":80,"
                    + "\"temperature\":0.6"
                    + "}";

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + groqApiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();

            // Parse content field from JSON response
            int start = body.indexOf("\"content\":\"") + 11;
            if (start > 11) {
                int end = body.indexOf("\",", start);
                if (end < 0) end = body.indexOf("\"}", start);
                if (end > start) {
                    return body.substring(start, end)
                            .replace("\\n", " ")
                            .replace("\\\"", "\"")
                            .trim();
                }
            }
            return "Route selected based on lowest traffic density.";

        } catch (Exception e) {
            System.err.println("[Groq] API error: " + e.getMessage());
            return "Route selected based on lowest traffic density.";
        }
    }

    // Unchanged route classification logic
    private Route createRoute(int traffic) {
        if (traffic < 30)
            return new Route("LOW", traffic, 5, "green");
        else if (traffic < 70)
            return new Route("MEDIUM", traffic, 7, "orange");
        else
            return new Route("HIGH", traffic, 10, "red");
    }

    private int random() {
        return new Random().nextInt(100);
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
