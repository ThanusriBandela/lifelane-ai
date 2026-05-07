package com.lifelane.lifelane_ai.controller;

import com.lifelane.lifelane_ai.model.Route;
import com.lifelane.lifelane_ai.service.TrafficAIService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class RouteController {

    private final TrafficAIService aiService;

    public RouteController(TrafficAIService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/routes")
    public List<Route> getRoutes() {
        return aiService.getLiveRoutes();
    }

    @PostMapping("/save")
    public Route saveRoute(@RequestBody Route route) {
        return aiService.saveToDB(route);
    }

    @GetMapping("/history")
    public List<Route> getHistory() {
        return aiService.getAllRoutes();
    }
}
