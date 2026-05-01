package com.lifelane.lifelane_ai.service;

import com.lifelane.lifelane_ai.model.Route;
import com.lifelane.lifelane_ai.repository.RouteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class TrafficAIService {

    private Map<String, Integer> trafficData = new HashMap<>();

    @Autowired
    private RouteRepository repo;

    public void updateTraffic(String road, int level) {
        trafficData.put(road, level);
    }

    public List<Route> getLiveRoutes() {
        int r1 = trafficData.getOrDefault("R1", 10);
        int r2 = trafficData.getOrDefault("R2", 20);
        int r3 = trafficData.getOrDefault("R3", 30);
        List<Route> routes = new ArrayList<>();
        routes.add(new Route("LOW", r1, 5, "green"));
        routes.add(new Route("MEDIUM", r2, 6, "orange"));
        routes.add(new Route("HIGH", r3, 7, "red"));
        return routes;
    }

    public Route saveToDB(Route route) {
        return repo.save(route);
    }

    public List<Route> getAllRoutes() {
        return repo.findAll();
    }
}
