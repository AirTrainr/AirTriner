-- Fix trainer receiving notifications for their own actions.
-- Trainer should only be notified when athlete cancels a booking.
-- For confirmed, rejected, completed — only athlete needs to be notified.
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Always notify athlete
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

    -- Only notify trainer when booking is cancelled (either party can cancel)
    IF NEW.status = 'cancelled' THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        NEW.trainer_id,
        'BOOKING_CANCELLED'::notification_type,
        'Booking cancelled',
        'A booking has been cancelled.',
        jsonb_build_object('bookingId', NEW.id, 'status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
