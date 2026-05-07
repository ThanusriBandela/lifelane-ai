package com.lifelane.lifelane_ai.model;

import jakarta.persistence.*;

@Entity
@Table(name = "app_user")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true, nullable = false)
    private String email;

    private String password;

    // Emergency contact 1
    private String contact1Name;
    private String contact1Email;

    // Emergency contact 2
    private String contact2Name;
    private String contact2Email;

    public User() {
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String n) {
        this.name = n;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String e) {
        this.email = e;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String p) {
        this.password = p;
    }

    public String getContact1Name() {
        return contact1Name;
    }

    public void setContact1Name(String v) {
        this.contact1Name = v;
    }

    public String getContact1Email() {
        return contact1Email;
    }

    public void setContact1Email(String v) {
        this.contact1Email = v;
    }

    public String getContact2Name() {
        return contact2Name;
    }

    public void setContact2Name(String v) {
        this.contact2Name = v;
    }

    public String getContact2Email() {
        return contact2Email;
    }

    public void setContact2Email(String v) {
        this.contact2Email = v;
    }
}
