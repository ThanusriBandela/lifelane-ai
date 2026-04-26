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

    // Get all contacts for a driver
    @GetMapping
    public List<EmergencyContact> getContacts(@RequestParam(defaultValue = "driver1") String driver) {
        return repo.findByDriverName(driver);
    }

    // Add a new contact
    @PostMapping
    public EmergencyContact addContact(@RequestBody EmergencyContact contact) {
        if (contact.getDriverName() == null) contact.setDriverName("driver1");
        return repo.save(contact);
    }

    // Delete a contact
    @DeleteMapping("/{id}")
    public Map<String, String> deleteContact(@PathVariable Long id) {
        repo.deleteById(id);
        return Map.of("status", "deleted");
    }

    // Trigger emergency alert — notifies all contacts for this driver
    // In production: integrate Twilio (SMS) or SendGrid (email) here
    @PostMapping("/alert")
    public Map<String, Object> sendAlert(
            @RequestParam(defaultValue = "driver1") String driver,
            @RequestParam(defaultValue = "0.0") double lat,
            @RequestParam(defaultValue = "0.0") double lng) {

        List<EmergencyContact> contacts = repo.findByDriverName(driver);

        // Log alert (replace these with real SMS/email API calls)
        for (EmergencyContact c : contacts) {
            System.out.println("[ALERT] Sending to: " + c.getName()
                + " | Phone: " + c.getPhone()
                + " | Email: " + c.getEmail()
                + " | Location: " + lat + "," + lng
                + " | Maps: https://maps.google.com/?q=" + lat + "," + lng);
        }

        return Map.of(
            "status", "sent",
            "contactsNotified", contacts.size(),
            "location", lat + "," + lng
        );
    }
}
