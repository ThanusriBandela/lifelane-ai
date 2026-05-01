package com.lifelane.lifelane_ai.repository;

import com.lifelane.lifelane_ai.model.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, Long> {
    List<EmergencyContact> findByDriverName(String driverName);
}
