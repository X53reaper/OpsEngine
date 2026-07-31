-- Combined Prisma migrations for Safari Zetu frontend
-- Order: add_auth → init → add_itinerary_reviews_behavior → add_destination_table → add_filename_cloudflareid → add_is_iconic

-- ============================================================
-- Migration 1: 20260311034750_add_auth
-- ============================================================

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'tourist',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "zta_license_number" TEXT,
    "zta_verified" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");
CREATE UNIQUE INDEX "Operator_zta_license_number_key" ON "Operator"("zta_license_number");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Migration 2: 20260312070446_init
-- ============================================================

ALTER TABLE "Operator" ADD COLUMN "claimed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Operator" ADD COLUMN "province" TEXT;
ALTER TABLE "Operator" ADD COLUMN "subscription_tier" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Operator" ADD COLUMN "zta_registered" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "operator_id" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricePerNight" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_email" TEXT NOT NULL,
    "guest_country" TEXT,
    "check_in" TIMESTAMP(3) NOT NULL,
    "check_out" TIMESTAMP(3) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2),

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payout_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");
CREATE UNIQUE INDEX "WishlistItem_user_id_listing_id_key" ON "WishlistItem"("user_id", "listing_id");
CREATE UNIQUE INDEX "Availability_listing_id_date_key" ON "Availability"("listing_id", "date");

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Migration 3: 20260313030657_add_itinerary_reviews_behavior
-- ============================================================

CREATE TABLE "Itinerary" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "travelers" INTEGER NOT NULL DEFAULT 1,
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "share_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Itinerary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItineraryDay" (
    "id" TEXT NOT NULL,
    "itinerary_id" TEXT NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "destination" TEXT NOT NULL,
    "notes" TEXT,
    "lodge_id" TEXT,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItineraryActivity" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" TEXT,
    "notes" TEXT,

    CONSTRAINT "ItineraryActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "overall_rating" DOUBLE PRECISION NOT NULL,
    "location_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cleanliness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "service" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wildlife" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "food" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "photos" TEXT[],
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "operator_reply" TEXT,
    "operator_reply_at" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBehavior" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "listing_id" TEXT,
    "destination" TEXT,
    "category" TEXT,
    "duration_ms" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBehavior_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingScore" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "wishlist_count" INTEGER NOT NULL DEFAULT 0,
    "booking_count" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trending_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Itinerary_share_token_key" ON "Itinerary"("share_token");
CREATE UNIQUE INDEX "Review_booking_id_key" ON "Review"("booking_id");
CREATE UNIQUE INDEX "ListingScore_listing_id_key" ON "ListingScore"("listing_id");

ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "Itinerary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItineraryActivity" ADD CONSTRAINT "ItineraryActivity_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "ItineraryDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Migration 4: 20260428000000_add_destination_table
-- ============================================================

CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "bestTimeToVisit" TEXT NOT NULL,
    "wildlife" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gettingThere" TEXT NOT NULL,
    "parkRules" TEXT,
    "mapCoordinates" TEXT,
    "imageUrl" TEXT,
    "heroImageUrl" TEXT,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DestinationImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DestinationImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");
CREATE INDEX "DestinationImage_destinationId_idx" ON "DestinationImage"("destinationId");
CREATE INDEX "DestinationImage_type_idx" ON "DestinationImage"("type");
ALTER TABLE "DestinationImage" ADD CONSTRAINT "DestinationImage_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Migration 5: 1779262174894_add_filename_cloudflareid_to_destinationimage
-- ============================================================

ALTER TABLE "DestinationImage" ADD COLUMN "fileName" TEXT;
ALTER TABLE "DestinationImage" ADD COLUMN "cloudflareId" TEXT;
CREATE UNIQUE INDEX "DestinationImage_cloudflareId_key" ON "DestinationImage" ("cloudflareId");

-- ============================================================
-- Migration 6: 20260617160000_add_is_iconic_to_destination
-- ============================================================

ALTER TABLE "Destination" ADD COLUMN "is_iconic" BOOLEAN NOT NULL DEFAULT false;
