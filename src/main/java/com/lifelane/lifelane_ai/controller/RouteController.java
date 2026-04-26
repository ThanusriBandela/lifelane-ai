package com.lifelane.lifelane_ai.controller;

import com.lifelane.lifelane_ai.model.Route;
import com.lifelane.lifelane_ai.repository.RouteRepository;
import com.lifelane.lifelane_ai.service.TrafficAIService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class RouteController {

    private final TrafficAIService service;
    private final RouteRepository repo;

    public RouteController(TrafficAIService service, RouteRepository repo) {
        this.service = service;
        this.repo = repo;
    }

    // Live route options (for AI traffic panel)
    @GetMapping("/routes")
    public List<Route> getRoutes() {
        return service.getLiveRoutes();
    }

    // Best route with Groq AI explanation
    @GetMapping("/best-route")
    public Route getBestRoute(@RequestParam(defaultValue = "false") boolean emergency) {
        return service.getBestRoute(emergency);
    }

    // Save a dispatch record from the frontend
    @PostMapping("/routes")
    public Map<String, Object> saveRoute(@RequestBody Map<String, Object> data) {
        Route r = new Route();
        r.setSourceName(str(data, "sourceName"));
        r.setDestName(str(data, "destName"));
        r.setDistanceKm(toDouble(data.get("distanceKm")));
        r.setDurationMin(toInt(data.get("durationMin")));
        r.setRouteType(str(data, "routeType"));
        r.setVehicleType(str(data, "vehicleType"));
        r.setRfidTag(str(data, "rfidTag"));
        r.setDispatchedAt(LocalDateTime.now());
        // traffic defaults
        r.setType("DISPATCH");
        r.setTraffic(0);
        r.setTime(r.getDurationMin() != null ? r.getDurationMin() : 0);
        r.setColor("blue");
        repo.save(r);
        System.out.println("[Dispatch] Saved: " + r.getVehicleType() + " → " + r.getDestName());
        return Map.of("status", "saved", "id", r.getId());
    }

    // Return all dispatch history records
    @GetMapping("/dispatch-history")
    public List<Route> getDispatchHistory() {
        return repo.findAllDispatches();
    }

    // helpers
    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k); return v != null ? v.toString() : null;
    }
    private Double toDouble(Object v) {
        if (v == null) return null;
        try { return Double.parseDouble(v.toString()); } catch (Exception e) { return null; }
    }
    private Integer toInt(Object v) {
        if (v == null) return null;
        try { return (int) Math.round(Double.parseDouble(v.toString())); } catch (Exception e) { return null; }
    }
}
