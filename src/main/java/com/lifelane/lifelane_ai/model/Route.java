package com.lifelane.lifelane_ai.model;

import jakarta.persistence.*;

@Entity
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;
    private int trafficLevel;
    private int time;
    private String color;
    private String source;
    private String destination;
    private String mode;
    private String vehicleType;
    private String rfidTag;
    private double distance;
    private String createdAt;

    public Route() {}

    public Route(String type, int trafficLevel, int time, String color) {
        this.type = type;
        this.trafficLevel = trafficLevel;
        this.time = time;
        this.color = color;
    }

    public Long getId() { return id; }
    public String getType() { return type; }
    public int getTrafficLevel() { return trafficLevel; }
    public int getTime() { return time; }
    public String getColor() { return color; }
    public String getSource() { return source; }
    public String getDestination() { return destination; }
    public String getMode() { return mode; }
    public String getVehicleType() { return vehicleType; }
    public String getRfidTag() { return rfidTag; }
    public double getDistance() { return distance; }
    public String getCreatedAt() { return createdAt; }

    public void setType(String type) { this.type = type; }
    public void setTrafficLevel(int trafficLevel) { this.trafficLevel = trafficLevel; }
    public void setTime(int time) { this.time = time; }
    public void setColor(String color) { this.color = color; }
    public void setSource(String source) { this.source = source; }
    public void setDestination(String destination) { this.destination = destination; }
    public void setMode(String mode) { this.mode = mode; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }
    public void setRfidTag(String rfidTag) { this.rfidTag = rfidTag; }
    public void setDistance(double distance) { this.distance = distance; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
