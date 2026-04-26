package com.lifelane.lifelane_ai.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // original fields
    private String type;
    private int traffic;
    private int time;
    private String color;

    @Column(length = 600)
    private String aiExplanation;

    // dispatch record fields
    private String sourceName;
    private String destName;
    private Double distanceKm;
    private Integer durationMin;
    private String routeType;      // NORMAL or EMERGENCY
    private String vehicleType;    // AMBULANCE, FIRE_TRUCK, POLICE, HAZMAT, NORMAL
    private String rfidTag;
    private LocalDateTime dispatchedAt;

    public Route() {}

    public Route(String type, int traffic, int time, String color) {
        this.type = type;
        this.traffic = traffic;
        this.time = time;
        this.color = color;
    }

    // getters & setters
    public Long getId() { return id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public int getTraffic() { return traffic; }
    public void setTraffic(int traffic) { this.traffic = traffic; }

    public int getTime() { return time; }
    public void setTime(int time) { this.time = time; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getAiExplanation() { return aiExplanation; }
    public void setAiExplanation(String aiExplanation) { this.aiExplanation = aiExplanation; }

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }

    public String getDestName() { return destName; }
    public void setDestName(String destName) { this.destName = destName; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Integer getDurationMin() { return durationMin; }
    public void setDurationMin(Integer durationMin) { this.durationMin = durationMin; }

    public String getRouteType() { return routeType; }
    public void setRouteType(String routeType) { this.routeType = routeType; }

    public String getVehicleType() { return vehicleType; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }

    public String getRfidTag() { return rfidTag; }
    public void setRfidTag(String rfidTag) { this.rfidTag = rfidTag; }

    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }
}
