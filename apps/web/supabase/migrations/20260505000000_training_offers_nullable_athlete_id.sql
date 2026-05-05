-- Allow training_offers rows without a specific athlete (trainer package offers)
-- Targeted offers (sent via Send Offer) still carry an athlete_id.
-- Package offers created from the My Packages tab do not.
ALTER TABLE training_offers ALTER COLUMN athlete_id DROP NOT NULL;
