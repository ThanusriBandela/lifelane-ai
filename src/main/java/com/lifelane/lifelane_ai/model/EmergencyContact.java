package com.lifelane.lifelane_ai.model;

import jakarta.persistence.*;

@Entity
public class EmergencyContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String driverName;   // which driver this contact belongs to
    private String name;
    private String phone;
    private String email;
    private String relationship; // FAMILY, FRIEND, COLLEAGUE

    public EmergencyContact() {}

    public Long getId() { return id; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRelationship() { return relationship; }
    public void setRelationship(String relationship) { this.relationship = relationship; }
}
