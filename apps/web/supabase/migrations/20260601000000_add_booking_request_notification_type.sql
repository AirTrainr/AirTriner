-- Add BOOKING_REQUEST to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'BOOKING_REQUEST';
