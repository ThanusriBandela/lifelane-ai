package com.lifelane.lifelane_ai.controller;

import com.lifelane.lifelane_ai.service.TrafficAIService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketController {

    private final TrafficAIService service;

    public WebSocketController(TrafficAIService service) {
        this.service = service;
    }

    // RECEIVE FROM FRONTEND
    @MessageMapping("/traffic")
    public void receiveTraffic(String msg) {

        // format: R1:25
        String[] parts = msg.split(":");

        String road = parts[0];
        int level = Integer.parseInt(parts[1]);

        service.updateTraffic(road, level);

        System.out.println("Traffic Updated: " + road + " -> " + level);
    }
    @MessageMapping("/emergency-alert")
public void sendAlert(String message) {

    System.out.println("🚨 Emergency: " + message);

    // Broadcast to all vehicles
    template.convertAndSend("/topic/emergency-alerts", message);
}
}