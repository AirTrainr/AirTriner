-- Fix notify_nearby_trainers trigger function
-- Bug: trainer.latitude and trainer.longitude were used in Haversine calculation
-- but were not included in the SELECT statement, causing 42703 error
-- which prevented athlete location from being saved.
-- Also adds missing 'new_athlete_nearby' notification_type enum value.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_athlete_nearby';

CREATE OR REPLACE FUNCTION notify_nearby_trainers()
RETURNS TRIGGER AS $$
DECLARE
    trainer RECORD;
    distance FLOAT;
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND NEW.sports IS NOT NULL THEN
        FOR trainer IN
            SELECT tp.id, tp.user_id, tp.travel_radius_miles, tp.latitude, tp.longitude
            FROM trainer_profiles tp
            WHERE tp.is_verified = true
            AND tp.sports && NEW.sports
            AND (tp.target_skill_levels IS NULL OR NEW.skill_level = ANY(tp.target_skill_levels))
            AND (
                tp."preferredTrainingTimes" IS NULL OR
                NEW."preferredTrainingTimes" IS NULL OR
                tp."preferredTrainingTimes" && NEW."preferredTrainingTimes"
            )
            AND tp.latitude IS NOT NULL AND tp.longitude IS NOT NULL
        LOOP
            distance := 3958.8 * 2 * ASIN(SQRT(
                POWER(SIN((trainer.latitude - NEW.latitude) * PI() / 180 / 2), 2) +
                COS(NEW.latitude * PI() / 180) * COS(trainer.latitude * PI() / 180) *
                POWER(SIN((trainer.longitude - NEW.longitude) * PI() / 180 / 2), 2)
            ));
            IF distance <= trainer.travel_radius_miles THEN
                INSERT INTO notifications (user_id, type, title, body, data, created_at)
                VALUES (
                    trainer.user_id,
                    'new_athlete_nearby',
                    'New Athlete in Your Area!',
                    'An athlete matching your criteria is looking for trainers nearby.',
                    jsonb_build_object('athlete_id', NEW.id, 'distance_miles', ROUND(distance::numeric, 1)),
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
