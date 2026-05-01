package com.lifelane.lifelane_ai.model;

import jakarta.persistence.*;

@Entity
public class EmergencyContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String driverName;
    private String name;
    private String phone;
    private String email;
    private String relationship;

    public EmergencyContact() {}

    public Long getId() { return id; }
    public String getDriverName() { return driverName; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public String getRelationship() { return relationship; }

    public void setId(Long id) { this.id = id; }
    public void setDriverName(String driverName) { this.driverName = driverName; }
    public void setName(String name) { this.name = name; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setEmail(String email) { this.email = email; }
    public void setRelationship(String relationship) { this.relationship = relationship; }
}
