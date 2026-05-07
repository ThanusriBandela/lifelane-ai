package com.lifelane.lifelane_ai.service;

import com.lifelane.lifelane_ai.model.Route;
import com.lifelane.lifelane_ai.repository.RouteRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RouteService {

    private final RouteRepository repo;

    public RouteService(RouteRepository repo) {
        this.repo = repo;
    }

    // SAVE ROUTE
    public Route saveRoute(Route route) {
        return repo.save(route);
    }

    // GET ALL ROUTES
    public List<Route> getAllRoutes() {
        return repo.findAll();
    }
}