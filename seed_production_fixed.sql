-- Safari Zetu Production Seed Data (FIXED)
-- Destinations, Operators, Listings, Settings

-- ============================================================
-- 1. DESTINATIONS (9 Zimbabwe destinations) - already seeded
-- ============================================================

-- ============================================================
-- 2. OPERATORS (sample Zimbabwe safari operators)
-- ============================================================

INSERT INTO "Operator" ("id", "email", "business_name", "password_hash", "phone", "zta_verified", "role", "claimed", "province", "subscription_tier", "status", "onboarding_complete", "public_profile", "notify_enquiries", "notify_bookings", "created_at") VALUES
('op-001', 'reservations@thehide.com', 'The Hide Safari Camp', '$2b$10$fakehashplaceholder001', '+263 4 770 181', true, 'OPERATOR', true, 'Matabeleland North', 'premium', 'APPROVED', true, true, true, true, NOW()),
('op-002', 'info@ruckomechi.com', 'Ruckomechi Camp', '$2b$10$fakehashplaceholder002', '+263 4 770 222', true, 'OPERATOR', true, 'Matabeleland North', 'premium', 'APPROVED', true, true, true, true, NOW()),
('op-003', 'bookings@victoriafallsbungee.com', 'Victoria Falls Bungee', '$2b$10$fakehashplaceholder003', '+263 4 770 333', true, 'OPERATOR', true, 'Matabeleland North', 'standard', 'APPROVED', true, true, true, true, NOW()),
('op-004', 'reservations@matetsisafari.com', 'Matetsi Private Game Reserve', '$2b$10$fakehashplaceholder004', '+263 4 770 444', true, 'OPERATOR', true, 'Matabeleland North', 'premium', 'APPROVED', true, true, true, true, NOW()),
('op-005', 'info@londolozi.com', 'Londolozi Private Granite Suites', '$2b$10$fakehashplaceholder005', '+27 13 735 5600', true, 'OPERATOR', true, 'Matabeleland North', 'premium', 'APPROVED', true, true, true, true, NOW())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- 3. LISTINGS (sample lodges and activities)
-- ============================================================

INSERT INTO "Listing" ("id", "title", "slug", "description", "category", "destination", "province", "operator_id", "images", "pricePerNight", "price_low_season", "min_nights", "max_guests", "total_units", "whats_included", "cancellation_policy", "is_instant_book", "is_featured", "average_rating", "total_reviews", "status", "is_active", "seasonality", "created_at", "updated_at") VALUES
('list-001', 'The Hide Safari Camp - Main Camp', 'the-hide-safari-camp-main', 'Award-winning tented camp in the heart of Hwange, offering intimate wildlife encounters and world-class guiding.', 'LODGE', 'hwange', 'Matabeleland North', 'op-001', ARRAY['/images/listings/the-hide-1.jpg','/images/listings/the-hide-2.jpg'], 650, 450, 2, 2, 10, 'All meals, game drives, walking safaris, laundry, Wi-Fi', 'Free cancellation up to 30 days before check-in', true, true, 4.9, 127, 'ACTIVE', true, 'peak', NOW(), NOW()),
('list-002', 'The Hide Safari Camp - Dogonjere', 'the-hide-dogonjere', 'Exclusive-use tented camp perfect for families and small groups seeking privacy in Hwange.', 'LODGE', 'hwange', 'Matabeleland North', 'op-001', ARRAY['/images/listings/the-hide-dogonjere-1.jpg'], 1200, 900, 3, 8, 1, 'Private chef, all meals, exclusive game viewer, walking safaris', 'Free cancellation up to 30 days before check-in', true, true, 5.0, 42, 'ACTIVE', true, 'peak', NOW(), NOW()),
('list-003', 'Ruckomechi Camp', 'ruckomechi-camp', 'Luxury tented camp on the banks of the Zambezi River in Mana Pools. Famous for its elephant encounters.', 'LODGE', 'mana-pools', 'Mashonaland West', 'op-002', ARRAY['/images/listings/ruckomechi-1.jpg'], 750, 550, 2, 2, 10, 'All meals, game drives, walking safaris, canoeing, drinks', 'Free cancellation up to 45 days before check-in', true, true, 4.8, 89, 'ACTIVE', true, 'peak', NOW(), NOW()),
('list-004', 'Victoria Falls Bungee - Bridge Swing', 'vic-falls-bridge-swing', 'The ultimate adrenaline rush - 111m free-fall from Victoria Falls Bridge over the Zambezi Gorge.', 'ACTIVITY', 'victoria-falls', 'Matabeleland North', 'op-003', ARRAY['/images/listings/bungee-1.jpg'], 150, 150, 1, 1, 20, 'Harness, safety briefing, certificate', 'Non-refundable within 7 days', true, false, 4.7, 203, 'ACTIVE', true, 'peak', NOW(), NOW()),
('list-005', 'Victoria Falls Helicopter Flight - Flight of Angels', 'vic-falls-helicopter', 'Spectacular helicopter flight over Victoria Falls. The Flight of Angels gives you the best views of the falls.', 'ACTIVITY', 'victoria-falls', 'Matabeleland North', 'op-003', ARRAY['/images/listings/helicopter-1.jpg'], 180, 180, 1, 6, 4, '15-minute scenic helicopter flight', 'Non-refundable within 3 days', true, true, 4.9, 312, 'ACTIVE', true, 'peak', NOW(), NOW()),
('list-006', 'Matetsi Private Game Reserve', 'matetsi-private-reserve', 'Ultra-luxury lodge on a private concession along the Zambezi River, upstream from Victoria Falls.', 'LODGE', 'zambezi', 'Matabeleland North', 'op-004', ARRAY['/images/listings/matetsi-1.jpg'], 1100, 800, 2, 2, 16, 'All meals, premium drinks, game drives, boat cruises, walking safaris, spa', 'Free cancellation up to 60 days before check-in', true, true, 4.9, 67, 'ACTIVE', true, 'peak', NOW(), NOW()),
('list-007', 'Hwange Main Camp - National Parks Lodge', 'hwange-main-camp-lodge', 'Affordable government-run lodge at the heart of Hwange. Perfect for budget-conscious safari lovers.', 'LODGE', 'hwange', 'Matabeleland North', 'op-001', ARRAY['/images/listings/hwange-main-1.jpg'], 120, 80, 1, 4, 20, 'Self-catering, guided walks available', 'Free cancellation up to 14 days before check-in', true, false, 3.8, 45, 'ACTIVE', true, 'off-peak', NOW(), NOW()),
('list-008', 'Mana Pools Walking Safari', 'mana-pools-walking-safari', 'Multi-day walking safari through the Mana Pools floodplain with expert guides. The ultimate wilderness experience.', 'ACTIVITY', 'mana-pools', 'Mashonaland West', 'op-002', ARRAY['/images/listings/walking-safari-1.jpg'], 350, 300, 3, 6, 1, 'All meals, camping equipment, guiding fees, park fees', 'Free cancellation up to 60 days before check-in', false, true, 4.8, 34, 'ACTIVE', true, 'peak', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- ============================================================
-- 4. SETTINGS (stat overrides for homepage counters)
-- ============================================================

INSERT INTO "Setting" ("id", "key", "value", "category", "isActive", "createdAt", "updatedAt") VALUES
('set-001', 'stat_destinations', '9', 'stats', true, NOW(), NOW()),
('set-002', 'stat_operators', '5', 'stats', true, NOW(), NOW()),
('set-003', 'stat_listings', '8', 'stats', true, NOW(), NOW()),
('set-004', 'stat_community_jobs', '12', 'stats', true, NOW(), NOW()),
('set-005', 'siteName', 'Safari Zetu', 'general', true, NOW(), NOW()),
('set-006', 'contactEmail', 'support@safarizetu.com', 'contact', true, NOW(), NOW()),
('set-007', 'contactAddress', 'Harare, Zimbabwe', 'contact', true, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- ============================================================
-- 5. PLATFORM SETTINGS
-- ============================================================

INSERT INTO "PlatformSettings" ("id", "commissionRate", "commissionRateLabel", "updatedAt") VALUES
('default', 0.15, '15%', NOW())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- 6. HERO SLIDES (sample)
-- ============================================================

INSERT INTO "HeroSlide" ("id", "imageUrl", "title", "subtitle", "ctaLabel", "ctaLink", "order", "isActive", "destination", "createdAt", "updatedAt") VALUES
('hero-001', '/images/destinations/victoria-falls/victoria-falls-zimbabwe-11.jpg', 'Discover Victoria Falls', 'One of the Seven Natural Wonders', 'Explore', '/destinations/victoria-falls', 1, true, 'Victoria Falls', NOW(), NOW()),
('hero-002', '/images/destinations/hwange/hero_v2.jpg', 'Hwange National Park', 'Home to 40,000 elephants', 'Explore', '/destinations/hwange', 2, true, 'Hwange', NOW(), NOW()),
('hero-003', '/images/destinations/mana-pools/hero_highres.jpg', 'Mana Pools Safari', 'UNESCO World Heritage Site', 'Explore', '/destinations/mana-pools', 3, true, 'Mana Pools', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- 7. CATEGORIES
-- ============================================================

INSERT INTO "Category" ("id", "name", "slug", "description", "createdAt", "updatedAt") VALUES
('cat-001', 'Lodges', 'lodges', 'Safari lodges and camps', NOW(), NOW()),
('cat-002', 'Activities', 'activities', 'Adventures and experiences', NOW(), NOW()),
('cat-003', 'Tour Operators', 'tour-operators', 'Guided safari operators', NOW(), NOW()),
('cat-004', 'Car Hire', 'car-hire', 'Vehicle rental services', NOW(), NOW()),
('cat-005', 'Restaurants', 'restaurants', 'Dining and cuisine', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
