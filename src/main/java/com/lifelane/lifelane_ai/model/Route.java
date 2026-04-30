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

    public Route() {
    }

    public Route(String type, int trafficLevel, int time, String color) {
        this.type = type;
        this.trafficLevel = trafficLevel;
        this.time = time;
        this.color = color;
    }

    public Long getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public int getTrafficLevel() {
        return trafficLevel;
    }

    public int getTime() {
        return time;
    }

    public String getColor() {
        return color;
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setTrafficLevel(int trafficLevel) {
        this.trafficLevel = trafficLevel;
    }

    public void setTime(int time) {
        this.time = time;
    }

    public void setColor(String color) {
        this.color = color;
    }
}