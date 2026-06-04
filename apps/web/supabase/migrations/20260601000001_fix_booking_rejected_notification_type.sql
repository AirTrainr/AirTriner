-- Fix notify_booking_status_change: add BOOKING_REJECTED type for rejected bookings
-- Original had ELSE fallback to BOOKING_CONFIRMED which was wrong for rejected status
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify athlete
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.athlete_id,
      CASE NEW.status
        WHEN 'confirmed' THEN 'BOOKING_CONFIRMED'::notification_type
        WHEN 'cancelled' THEN 'BOOKING_CANCELLED'::notification_type
        WHEN 'completed' THEN 'BOOKING_COMPLETED'::notification_type
        WHEN 'rejected'  THEN 'BOOKING_REJECTED'::notification_type
        ELSE 'BOOKING_CONFIRMED'::notification_type
      END,
      'Booking ' || NEW.status,
      'Your booking has been ' || NEW.status || '.',
      jsonb_build_object('bookingId', NEW.id, 'status', NEW.status)
    );
    -- Notify trainer
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.trainer_id,
      CASE NEW.status
        WHEN 'confirmed' THEN 'BOOKING_CONFIRMED'::notification_type
        WHEN 'cancelled' THEN 'BOOKING_CANCELLED'::notification_type
        WHEN 'completed' THEN 'BOOKING_COMPLETED'::notification_type
        WHEN 'rejected'  THEN 'BOOKING_REJECTED'::notification_type
        ELSE 'BOOKING_CONFIRMED'::notification_type
      END,
      'Booking ' || NEW.status,
      'A booking has been ' || NEW.status || '.',
      jsonb_build_object('bookingId', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
