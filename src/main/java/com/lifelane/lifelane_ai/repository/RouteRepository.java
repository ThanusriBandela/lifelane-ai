package com.lifelane.lifelane_ai.repository;

import com.lifelane.lifelane_ai.model.Route;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface RouteRepository extends JpaRepository<Route, Long> {

    // Only return records that were saved as dispatches (have a dispatchedAt timestamp)
    @Query("SELECT r FROM Route r WHERE r.dispatchedAt IS NOT NULL ORDER BY r.dispatchedAt DESC")
    List<Route> findAllDispatches();
}
