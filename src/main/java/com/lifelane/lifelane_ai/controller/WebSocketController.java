package com.lifelane.lifelane_ai.controller;

import com.lifelane.lifelane_ai.service.TrafficAIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketController {

    private final TrafficAIService service;

    @Autowired
    private SimpMessagingTemplate template;

    public WebSocketController(TrafficAIService service) {
        this.service = service;
    }

    @MessageMapping("/traffic")
    public void receiveTraffic(String msg) {
        String[] parts = msg.split(":");
        String road = parts[0];
        int level = Integer.parseInt(parts[1]);
        service.updateTraffic(road, level);
        System.out.println("Traffic Updated: " + road + " -> " + level);
    }

    @MessageMapping("/emergency-alert")
    public void sendAlert(String message) {
        System.out.println("Emergency Alert: " + message);
        template.convertAndSend("/topic/emergency-alerts", message);
    }
}
