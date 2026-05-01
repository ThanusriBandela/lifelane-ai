package com.lifelane.lifelane_ai.controller;

import com.lifelane.lifelane_ai.model.EmergencyContact;
import com.lifelane.lifelane_ai.repository.EmergencyContactRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/contacts")
@CrossOrigin
public class EmergencyContactController {

    private final EmergencyContactRepository repo;

    public EmergencyContactController(EmergencyContactRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<EmergencyContact> getContacts(@RequestParam(defaultValue = "driver1") String driver) {
        return repo.findByDriverName(driver);
    }

    @PostMapping
    public EmergencyContact addContact(@RequestBody EmergencyContact contact) {
        if (contact.getDriverName() == null) contact.setDriverName("driver1");
        return repo.save(contact);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> deleteContact(@PathVariable Long id) {
        repo.deleteById(id);
        return Map.of("status", "deleted");
    }

    @PostMapping("/alert")
    public Map<String, Object> sendAlert(
            @RequestParam(defaultValue = "driver1") String driver,
            @RequestParam(required = false) List<String> phone,
            @RequestParam(defaultValue = "0.0") double lat,
            @RequestParam(defaultValue = "0.0") double lng) {

        // Use phone numbers from request params (from account) or fall back to DB
        int notified = 0;
        if (phone != null && !phone.isEmpty()) {
            for (String p : phone) {
                System.out.println("[CRASH ALERT] Sending SMS to: " + p
                    + " | Location: " + lat + "," + lng
                    + " | Maps: https://maps.google.com/?q=" + lat + "," + lng);
                notified++;
            }
        } else {
            List<EmergencyContact> contacts = repo.findByDriverName(driver);
            for (EmergencyContact c : contacts) {
                System.out.println("[CRASH ALERT] Sending to: " + c.getName()
                    + " | Phone: " + c.getPhone()
                    + " | Location: " + lat + "," + lng);
                notified++;
            }
        }

        return Map.of(
            "status", "sent",
            "contactsNotified", notified,
            "location", lat + "," + lng
        );
    }
}
