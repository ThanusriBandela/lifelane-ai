package com.lifelane.lifelane_ai.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class VehicleSimulationService {

    private final SimpMessagingTemplate template;

    public VehicleSimulationService(SimpMessagingTemplate template) {
        this.template = template;
    }

    @Scheduled(fixedRate = 3000)
    public void simulateVehicles() {

        Map<String, Object> vehicle = new HashMap<>();

        vehicle.put("vehicleId", "CAR-" + new Random().nextInt(100));
        vehicle.put("lat", 17.45 + Math.random() / 100);
        vehicle.put("lng", 78.36 + Math.random() / 100);

        template.convertAndSend("/topic/vehicle-positions", vehicle);

        System.out.println("Vehicle sent");
    }
}