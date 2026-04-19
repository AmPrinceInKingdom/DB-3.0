
BEGIN;
SET TIME ZONE 'UTC';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='user_role') THEN CREATE TYPE user_role AS ENUM ('CUSTOMER','ADMIN','SUPER_ADMIN','SELLER'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='account_status') THEN CREATE TYPE account_status AS ENUM ('ACTIVE','PENDING','SUSPENDED','DELETED'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='product_status') THEN CREATE TYPE product_status AS ENUM ('DRAFT','ACTIVE','INACTIVE','ARCHIVED'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='stock_status') THEN CREATE TYPE stock_status AS ENUM ('IN_STOCK','LOW_STOCK','OUT_OF_STOCK','PREORDER'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='order_status') THEN CREATE TYPE order_status AS ENUM ('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_status') THEN CREATE TYPE payment_status AS ENUM ('PENDING','PAID','FAILED','REFUNDED','AWAITING_VERIFICATION'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_method') THEN CREATE TYPE payment_method AS ENUM ('CARD','BANK_TRANSFER','CASH_ON_DELIVERY'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='notification_type') THEN CREATE TYPE notification_type AS ENUM ('ORDER','PAYMENT','REVIEW','STOCK','PROMOTION','SYSTEM'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='banner_type') THEN CREATE TYPE banner_type AS ENUM ('HERO','PROMOTION','CATEGORY','FLASH_DEAL'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='discount_type') THEN CREATE TYPE discount_type AS ENUM ('PERCENTAGE','FIXED'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='discount_scope') THEN CREATE TYPE discount_scope AS ENUM ('ORDER','PRODUCT','CATEGORY'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='review_status') THEN CREATE TYPE review_status AS ENUM ('PENDING','APPROVED','REJECTED'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='shipment_status') THEN CREATE TYPE shipment_status AS ENUM ('PENDING','PACKED','IN_TRANSIT','DELIVERED','FAILED','RETURNED'); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payout_status') THEN CREATE TYPE payout_status AS ENUM ('PENDING','PROCESSING','PAID','FAILED'); END IF;
END$$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=NOW(); RETURN NEW; END;$$;
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 100001;
CREATE OR REPLACE FUNCTION generate_order_number() RETURNS TEXT LANGUAGE plpgsql AS $$DECLARE seq BIGINT; BEGIN seq:=nextval('order_number_seq'); RETURN 'DB-'||to_char(NOW(),'YYYYMMDD')||'-'||lpad(seq::TEXT,6,'0'); END;$$;

CREATE TABLE IF NOT EXISTS supported_currencies (code CHAR(3) PRIMARY KEY,name VARCHAR(64) NOT NULL,symbol VARCHAR(8) NOT NULL,decimals SMALLINT NOT NULL DEFAULT 2 CHECK(decimals BETWEEN 0 AND 4),is_active BOOLEAN NOT NULL DEFAULT TRUE,is_base BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS supported_currencies_base_unique ON supported_currencies(is_base) WHERE is_base;

CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),email CITEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role user_role NOT NULL DEFAULT 'CUSTOMER',status account_status NOT NULL DEFAULT 'ACTIVE',phone VARCHAR(32),email_verified_at TIMESTAMPTZ,last_login_at TIMESTAMPTZ,deleted_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT users_phone_format CHECK(phone IS NULL OR phone ~ '^[+0-9 ()-]{7,32}$'));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_not_null ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_status_idx ON users(role,status);

CREATE TABLE IF NOT EXISTS user_profiles (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,first_name VARCHAR(100),last_name VARCHAR(100),avatar_url TEXT,date_of_birth DATE,preferred_currency CHAR(3) NOT NULL DEFAULT 'LKR' REFERENCES supported_currencies(code),preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',theme_preference VARCHAR(10) NOT NULL DEFAULT 'system',preferred_payment_method payment_method NOT NULL DEFAULT 'CARD',preferred_shipping_method_code VARCHAR(50) NOT NULL DEFAULT 'STANDARD',notification_preferences JSONB NOT NULL DEFAULT '{"email":true,"sms":false,"push":true}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT user_profiles_checkout_payment_method_check CHECK(preferred_payment_method IN ('CARD','BANK_TRANSFER')));
CREATE TABLE IF NOT EXISTS admins (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,can_manage_admins BOOLEAN NOT NULL DEFAULT FALSE,notes TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS sellers (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,store_name VARCHAR(160) NOT NULL,store_slug VARCHAR(180) NOT NULL UNIQUE,status account_status NOT NULL DEFAULT 'PENDING',support_email CITEXT,support_phone VARCHAR(32),commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK(commission_rate BETWEEN 0 AND 100),tax_id VARCHAR(100),description TEXT,logo_url TEXT,banner_url TEXT,approved_by UUID REFERENCES users(id) ON DELETE SET NULL,approved_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT sellers_support_phone_format CHECK(support_phone IS NULL OR support_phone ~ '^[+0-9 ()-]{7,32}$'));
CREATE INDEX IF NOT EXISTS sellers_status_idx ON sellers(status);
CREATE TABLE IF NOT EXISTS seller_payout_accounts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),seller_id UUID NOT NULL REFERENCES sellers(user_id) ON DELETE CASCADE,bank_name VARCHAR(120) NOT NULL,account_name VARCHAR(180) NOT NULL,account_number VARCHAR(100) NOT NULL,branch_name VARCHAR(120),swift_code VARCHAR(32),is_default BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS seller_payout_default_unique ON seller_payout_accounts(seller_id) WHERE is_default;
CREATE TABLE IF NOT EXISTS seller_payouts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),seller_id UUID NOT NULL REFERENCES sellers(user_id) ON DELETE CASCADE,amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),currency_code CHAR(3) NOT NULL REFERENCES supported_currencies(code),status payout_status NOT NULL DEFAULT 'PENDING',period_start DATE,period_end DATE,paid_at TIMESTAMPTZ,reference VARCHAR(120),notes TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS user_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,session_token_hash TEXT NOT NULL UNIQUE,user_agent TEXT,ip_address INET,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS email_verification_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS password_reset_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS otp_codes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id) ON DELETE CASCADE,email CITEXT,purpose VARCHAR(50) NOT NULL,code_hash TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT otp_target_check CHECK(user_id IS NOT NULL OR email IS NOT NULL));

CREATE TABLE IF NOT EXISTS categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(140) NOT NULL UNIQUE,slug VARCHAR(160) NOT NULL UNIQUE,description TEXT,image_url TEXT,is_active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INT NOT NULL DEFAULT 0,seo_title VARCHAR(180),seo_description VARCHAR(320),seo_keywords TEXT[],created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS subcategories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,name VARCHAR(140) NOT NULL,slug VARCHAR(160) NOT NULL UNIQUE,description TEXT,image_url TEXT,is_active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INT NOT NULL DEFAULT 0,seo_title VARCHAR(180),seo_description VARCHAR(320),seo_keywords TEXT[],created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(category_id,name));
CREATE TABLE IF NOT EXISTS brands (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(160) NOT NULL UNIQUE,slug VARCHAR(180) NOT NULL UNIQUE,logo_url TEXT,description TEXT,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS product_tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(80) NOT NULL UNIQUE,slug VARCHAR(100) NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),seller_id UUID REFERENCES sellers(user_id) ON DELETE SET NULL,category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,name VARCHAR(220) NOT NULL,slug VARCHAR(250) NOT NULL UNIQUE,short_description VARCHAR(500),description TEXT,sku VARCHAR(120) NOT NULL UNIQUE,status product_status NOT NULL DEFAULT 'DRAFT',stock_status stock_status NOT NULL DEFAULT 'IN_STOCK',current_price NUMERIC(14,2) NOT NULL CHECK(current_price>=0),old_price NUMERIC(14,2) CHECK(old_price IS NULL OR old_price>=0),discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(discount_percentage BETWEEN 0 AND 100),stock_quantity INT NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),min_stock_level INT NOT NULL DEFAULT 5 CHECK(min_stock_level>=0),total_sold INT NOT NULL DEFAULT 0 CHECK(total_sold>=0),average_rating NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK(average_rating BETWEEN 0 AND 5),popularity_score NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(popularity_score>=0),weight_kg NUMERIC(10,3) CHECK(weight_kg IS NULL OR weight_kg>=0),dimensions JSONB,featured BOOLEAN NOT NULL DEFAULT FALSE,trending BOOLEAN NOT NULL DEFAULT FALSE,best_seller BOOLEAN NOT NULL DEFAULT FALSE,new_arrival BOOLEAN NOT NULL DEFAULT FALSE,has_variants BOOLEAN NOT NULL DEFAULT FALSE,optional_video_url TEXT,seo_title VARCHAR(180),seo_description VARCHAR(320),seo_keywords TEXT[],metadata JSONB NOT NULL DEFAULT '{}'::jsonb,published_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT products_old_price_gte_current_price_check CHECK(old_price IS NULL OR old_price>=current_price));
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',coalesce(name,'')||' '||coalesce(short_description,'')||' '||coalesce(description,''))) STORED;
CREATE INDEX IF NOT EXISTS products_search_vector_idx ON products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_category_status_idx ON products(category_id,subcategory_id,status);
CREATE INDEX IF NOT EXISTS products_flags_idx ON products(featured,trending,best_seller,new_arrival);

CREATE TABLE IF NOT EXISTS product_images (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,image_url TEXT NOT NULL,alt_text VARCHAR(180),sort_order INT NOT NULL DEFAULT 0,is_main BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS product_images_main_unique ON product_images(product_id) WHERE is_main;
CREATE TABLE IF NOT EXISTS product_videos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,video_url TEXT NOT NULL,provider VARCHAR(60),sort_order INT NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS product_attributes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(100) NOT NULL UNIQUE,slug VARCHAR(120) NOT NULL UNIQUE,input_type VARCHAR(40) NOT NULL DEFAULT 'select',is_required BOOLEAN NOT NULL DEFAULT FALSE,is_variant BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS product_attribute_values (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,value TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(product_id,attribute_id,value));
CREATE TABLE IF NOT EXISTS product_variants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,sku VARCHAR(120) NOT NULL UNIQUE,name VARCHAR(180),options JSONB NOT NULL DEFAULT '{}'::jsonb,price NUMERIC(14,2) NOT NULL CHECK(price>=0),old_price NUMERIC(14,2) CHECK(old_price IS NULL OR old_price>=0),stock_quantity INT NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),weight_kg NUMERIC(10,3) CHECK(weight_kg IS NULL OR weight_kg>=0),image_url TEXT,is_default BOOLEAN NOT NULL DEFAULT FALSE,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT product_variants_old_price_gte_price_check CHECK(old_price IS NULL OR old_price>=price));
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_default_unique ON product_variants(product_id) WHERE is_default;
CREATE TABLE IF NOT EXISTS product_variant_attribute_values (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,value TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(variant_id,attribute_id));
CREATE TABLE IF NOT EXISTS product_tag_map (product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,tag_id UUID NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(product_id,tag_id));

CREATE TABLE IF NOT EXISTS carts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,guest_token VARCHAR(120) UNIQUE,currency_code CHAR(3) NOT NULL DEFAULT 'LKR' REFERENCES supported_currencies(code),expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT carts_owner_check CHECK((user_id IS NOT NULL)<>(guest_token IS NOT NULL)));
CREATE TABLE IF NOT EXISTS cart_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,quantity INT NOT NULL CHECK(quantity>0),unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price>=0),currency_code CHAR(3) NOT NULL REFERENCES supported_currencies(code),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(cart_id,product_id,variant_id));
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_no_variant_unique ON cart_items(cart_id,product_id) WHERE variant_id IS NULL;
CREATE TABLE IF NOT EXISTS saved_cart_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,line_id VARCHAR(255) NOT NULL,product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,quantity INT NOT NULL DEFAULT 1 CHECK(quantity>0),saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,line_id));
CREATE INDEX IF NOT EXISTS saved_cart_items_user_saved_at_idx ON saved_cart_items(user_id,saved_at DESC);

CREATE TABLE IF NOT EXISTS wishlists (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS wishlist_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(wishlist_id,product_id));

CREATE TABLE IF NOT EXISTS compare_lists (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,guest_token VARCHAR(120) UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT compare_lists_owner_check CHECK((user_id IS NOT NULL)<>(guest_token IS NOT NULL)));
CREATE TABLE IF NOT EXISTS compare_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),compare_list_id UUID NOT NULL REFERENCES compare_lists(id) ON DELETE CASCADE,product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(compare_list_id,product_id));

CREATE TABLE IF NOT EXISTS addresses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,label VARCHAR(80),first_name VARCHAR(100) NOT NULL,last_name VARCHAR(100) NOT NULL,company VARCHAR(140),phone VARCHAR(32),line1 VARCHAR(220) NOT NULL,line2 VARCHAR(220),city VARCHAR(120) NOT NULL,state VARCHAR(120),postal_code VARCHAR(32),country_code CHAR(2) NOT NULL DEFAULT 'LK',is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT addresses_phone_format CHECK(phone IS NULL OR phone ~ '^[+0-9 ()-]{7,32}$'));
CREATE UNIQUE INDEX IF NOT EXISTS addresses_default_shipping_unique ON addresses(user_id) WHERE is_default_shipping;
CREATE UNIQUE INDEX IF NOT EXISTS addresses_default_billing_unique ON addresses(user_id) WHERE is_default_billing;
CREATE TABLE IF NOT EXISTS shipping_methods (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(120) NOT NULL UNIQUE,code VARCHAR(50) NOT NULL UNIQUE,description TEXT,base_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(base_fee>=0),estimated_days_min INT NOT NULL DEFAULT 1 CHECK(estimated_days_min>=0),estimated_days_max INT NOT NULL DEFAULT 3,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT shipping_days_check CHECK(estimated_days_max>=estimated_days_min));

CREATE TABLE IF NOT EXISTS coupons (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code CITEXT NOT NULL UNIQUE,title VARCHAR(160) NOT NULL,description TEXT,discount_type discount_type NOT NULL,discount_scope discount_scope NOT NULL DEFAULT 'ORDER',discount_value NUMERIC(14,2) NOT NULL CHECK(discount_value>=0),min_purchase_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(min_purchase_amount>=0),max_discount_amount NUMERIC(14,2) CHECK(max_discount_amount IS NULL OR max_discount_amount>=0),starts_at TIMESTAMPTZ,expires_at TIMESTAMPTZ,usage_limit INT,usage_limit_per_user INT NOT NULL DEFAULT 1 CHECK(usage_limit_per_user>0),used_count INT NOT NULL DEFAULT 0 CHECK(used_count>=0),is_active BOOLEAN NOT NULL DEFAULT TRUE,applicable_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,applicable_product_id UUID REFERENCES products(id) ON DELETE SET NULL,created_by UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT coupons_date_check CHECK(expires_at IS NULL OR starts_at IS NULL OR expires_at>starts_at),CONSTRAINT coupons_scope_check CHECK((discount_scope='ORDER' AND applicable_category_id IS NULL AND applicable_product_id IS NULL) OR (discount_scope='CATEGORY' AND applicable_category_id IS NOT NULL AND applicable_product_id IS NULL) OR (discount_scope='PRODUCT' AND applicable_product_id IS NOT NULL AND applicable_category_id IS NULL)));

CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_number VARCHAR(40) NOT NULL UNIQUE DEFAULT generate_order_number(),client_request_id VARCHAR(120),user_id UUID REFERENCES users(id) ON DELETE SET NULL,billing_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,shipping_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,shipping_method_id UUID REFERENCES shipping_methods(id) ON DELETE SET NULL,status order_status NOT NULL DEFAULT 'PENDING',payment_status payment_status NOT NULL DEFAULT 'PENDING',payment_method payment_method NOT NULL,currency_code CHAR(3) NOT NULL REFERENCES supported_currencies(code),exchange_rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1 CHECK(exchange_rate_to_base>0),subtotal NUMERIC(14,2) NOT NULL CHECK(subtotal>=0),discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(discount_total>=0),shipping_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(shipping_fee>=0),tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(tax_total>=0),grand_total NUMERIC(14,2) NOT NULL CHECK(grand_total>=0),coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,customer_email CITEXT NOT NULL,customer_phone VARCHAR(32),tracking_number VARCHAR(120),notes TEXT,admin_notes TEXT,placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),delivered_at TIMESTAMPTZ,cancelled_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT orders_phone_format CHECK(customer_phone IS NULL OR customer_phone ~ '^[+0-9 ()-]{7,32}$'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_request_id_unique ON orders(client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status,payment_status);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders(order_number);

CREATE TABLE IF NOT EXISTS order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,product_id UUID REFERENCES products(id) ON DELETE SET NULL,variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,seller_id UUID REFERENCES sellers(user_id) ON DELETE SET NULL,product_name VARCHAR(240) NOT NULL,sku VARCHAR(120),variant_name VARCHAR(180),unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price>=0),quantity INT NOT NULL CHECK(quantity>0),line_total NUMERIC(14,2) NOT NULL CHECK(line_total>=0),currency_code CHAR(3) NOT NULL REFERENCES supported_currencies(code),metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_status_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,old_status order_status,new_status order_status NOT NULL,changed_by UUID REFERENCES users(id) ON DELETE SET NULL,note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,payment_method payment_method NOT NULL,payment_status payment_status NOT NULL DEFAULT 'PENDING',transaction_reference VARCHAR(120) UNIQUE,gateway VARCHAR(80),gateway_payload JSONB,amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),currency_code CHAR(3) NOT NULL REFERENCES supported_currencies(code),paid_at TIMESTAMPTZ,failure_reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS payment_webhook_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),provider VARCHAR(40) NOT NULL,event_id VARCHAR(160),event_type VARCHAR(120) NOT NULL,reference VARCHAR(120),order_id UUID REFERENCES orders(id) ON DELETE SET NULL,payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,handled BOOLEAN NOT NULL DEFAULT FALSE,success BOOLEAN NOT NULL DEFAULT FALSE,payment_status payment_status,order_status order_status,error_code VARCHAR(120),error_message TEXT,payload JSONB NOT NULL DEFAULT '{}'::jsonb,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS payment_webhook_events_provider_idx ON payment_webhook_events(provider,created_at DESC);
CREATE INDEX IF NOT EXISTS payment_webhook_events_type_idx ON payment_webhook_events(event_type,created_at DESC);
CREATE INDEX IF NOT EXISTS payment_webhook_events_reference_idx ON payment_webhook_events(reference);
CREATE INDEX IF NOT EXISTS payment_webhook_events_order_idx ON payment_webhook_events(order_id);

CREATE TABLE IF NOT EXISTS payment_proofs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,file_url TEXT NOT NULL,file_name VARCHAR(255),mime_type VARCHAR(120),size_bytes BIGINT CHECK(size_bytes IS NULL OR size_bytes>=0),verification_status payment_status NOT NULL DEFAULT 'AWAITING_VERIFICATION',verified_by UUID REFERENCES users(id) ON DELETE SET NULL,verified_at TIMESTAMPTZ,rejection_reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT payment_proofs_status_check CHECK(verification_status IN ('AWAITING_VERIFICATION','PAID','FAILED')));
CREATE INDEX IF NOT EXISTS payment_proofs_order_idx ON payment_proofs(order_id,verification_status);

CREATE TABLE IF NOT EXISTS coupon_usages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,user_id UUID REFERENCES users(id) ON DELETE SET NULL,order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,discount_amount NUMERIC(14,2) NOT NULL CHECK(discount_amount>=0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS reviews (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,user_id UUID REFERENCES users(id) ON DELETE SET NULL,order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5),title VARCHAR(180),comment TEXT,status review_status NOT NULL DEFAULT 'PENDING',is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,helpful_count INT NOT NULL DEFAULT 0 CHECK(helpful_count>=0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(product_id,user_id,order_item_id));
CREATE TABLE IF NOT EXISTS review_images (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,image_url TEXT NOT NULL,sort_order INT NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id) ON DELETE CASCADE,type notification_type NOT NULL,title VARCHAR(180) NOT NULL,message TEXT NOT NULL,link_url TEXT,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,is_read BOOLEAN NOT NULL DEFAULT FALSE,sent_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS banners (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),type banner_type NOT NULL,title VARCHAR(180) NOT NULL,subtitle VARCHAR(280),image_url TEXT NOT NULL,mobile_image_url TEXT,cta_text VARCHAR(80),cta_url TEXT,position INT NOT NULL DEFAULT 0,is_active BOOLEAN NOT NULL DEFAULT TRUE,starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT banners_date_check CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at));
CREATE TABLE IF NOT EXISTS homepage_sections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),section_key VARCHAR(120) NOT NULL UNIQUE,title VARCHAR(180),subtitle VARCHAR(320),is_active BOOLEAN NOT NULL DEFAULT TRUE,config JSONB NOT NULL DEFAULT '{}'::jsonb,updated_by UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS inventory_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,changed_by UUID REFERENCES users(id) ON DELETE SET NULL,previous_quantity INT NOT NULL CHECK(previous_quantity>=0),change_amount INT NOT NULL,new_quantity INT NOT NULL CHECK(new_quantity>=0),reason VARCHAR(180),reference_type VARCHAR(80),reference_id UUID,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS currency_rates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),base_currency_code CHAR(3) NOT NULL REFERENCES supported_currencies(code),target_currency_code CHAR(3) NOT NULL REFERENCES supported_currencies(code),rate NUMERIC(18,8) NOT NULL CHECK(rate>0),source VARCHAR(120),effective_date DATE NOT NULL DEFAULT CURRENT_DATE,fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(base_currency_code,target_currency_code,effective_date),CONSTRAINT currency_rates_pair_check CHECK(base_currency_code<>target_currency_code));
CREATE TABLE IF NOT EXISTS site_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),setting_group VARCHAR(120) NOT NULL,setting_key VARCHAR(120) NOT NULL UNIQUE,setting_value JSONB NOT NULL,is_public BOOLEAN NOT NULL DEFAULT FALSE,description TEXT,updated_by UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,action VARCHAR(120) NOT NULL,target_table VARCHAR(120),target_id UUID,ip_address INET,user_agent TEXT,old_values JSONB,new_values JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS newsletter_subscribers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),email CITEXT NOT NULL UNIQUE,is_active BOOLEAN NOT NULL DEFAULT TRUE,subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),unsubscribed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS shipments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,shipping_method_id UUID REFERENCES shipping_methods(id) ON DELETE SET NULL,status shipment_status NOT NULL DEFAULT 'PENDING',tracking_number VARCHAR(120),courier_name VARCHAR(120),shipped_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,notes TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

DROP TRIGGER IF EXISTS trg_supported_currencies_updated_at ON supported_currencies; CREATE TRIGGER trg_supported_currencies_updated_at BEFORE UPDATE ON supported_currencies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_users_updated_at ON users; CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles; CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_admins_updated_at ON admins; CREATE TRIGGER trg_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_sellers_updated_at ON sellers; CREATE TRIGGER trg_sellers_updated_at BEFORE UPDATE ON sellers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_seller_payout_accounts_updated_at ON seller_payout_accounts; CREATE TRIGGER trg_seller_payout_accounts_updated_at BEFORE UPDATE ON seller_payout_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_seller_payouts_updated_at ON seller_payouts; CREATE TRIGGER trg_seller_payouts_updated_at BEFORE UPDATE ON seller_payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_user_sessions_updated_at ON user_sessions; CREATE TRIGGER trg_user_sessions_updated_at BEFORE UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories; CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_subcategories_updated_at ON subcategories; CREATE TRIGGER trg_subcategories_updated_at BEFORE UPDATE ON subcategories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands; CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_products_updated_at ON products; CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_product_attributes_updated_at ON product_attributes; CREATE TRIGGER trg_product_attributes_updated_at BEFORE UPDATE ON product_attributes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants; CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts; CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items; CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_saved_cart_items_updated_at ON saved_cart_items; CREATE TRIGGER trg_saved_cart_items_updated_at BEFORE UPDATE ON saved_cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_wishlists_updated_at ON wishlists; CREATE TRIGGER trg_wishlists_updated_at BEFORE UPDATE ON wishlists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_compare_lists_updated_at ON compare_lists; CREATE TRIGGER trg_compare_lists_updated_at BEFORE UPDATE ON compare_lists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses; CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_shipping_methods_updated_at ON shipping_methods; CREATE TRIGGER trg_shipping_methods_updated_at BEFORE UPDATE ON shipping_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons; CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders; CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments; CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_payment_webhook_events_updated_at ON payment_webhook_events; CREATE TRIGGER trg_payment_webhook_events_updated_at BEFORE UPDATE ON payment_webhook_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_payment_proofs_updated_at ON payment_proofs; CREATE TRIGGER trg_payment_proofs_updated_at BEFORE UPDATE ON payment_proofs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews; CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_banners_updated_at ON banners; CREATE TRIGGER trg_banners_updated_at BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_homepage_sections_updated_at ON homepage_sections; CREATE TRIGGER trg_homepage_sections_updated_at BEFORE UPDATE ON homepage_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON site_settings; CREATE TRIGGER trg_site_settings_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_shipments_updated_at ON shipments; CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
INSERT INTO supported_currencies(code,name,symbol,decimals,is_active,is_base) VALUES
('LKR','Sri Lankan Rupee','Rs',0,TRUE,TRUE),
('USD','US Dollar','$',2,TRUE,FALSE),
('EUR','Euro','EUR',2,TRUE,FALSE),
('GBP','British Pound','GBP',2,TRUE,FALSE),
('INR','Indian Rupee','INR',2,TRUE,FALSE)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,symbol=EXCLUDED.symbol,decimals=EXCLUDED.decimals,is_active=EXCLUDED.is_active,is_base=EXCLUDED.is_base,updated_at=NOW();

INSERT INTO currency_rates(base_currency_code,target_currency_code,rate,source) VALUES
('LKR','USD',0.0033,'seed'),('LKR','EUR',0.0030,'seed'),('LKR','GBP',0.0026,'seed'),('LKR','INR',0.27,'seed')
ON CONFLICT(base_currency_code,target_currency_code,effective_date) DO NOTHING;

INSERT INTO shipping_methods(name,code,description,base_fee,estimated_days_min,estimated_days_max,is_active) VALUES
('Standard Delivery','STANDARD','Reliable island-wide delivery',450,2,4,TRUE),
('Express Delivery','EXPRESS','Priority next-day delivery in selected regions',950,1,2,TRUE),
('Store Pickup','PICKUP','Pickup from selected collection points',0,0,1,TRUE)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,base_fee=EXCLUDED.base_fee,estimated_days_min=EXCLUDED.estimated_days_min,estimated_days_max=EXCLUDED.estimated_days_max,is_active=EXCLUDED.is_active,updated_at=NOW();

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_preferred_shipping_method_code_fkey;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_preferred_shipping_method_code_fkey FOREIGN KEY (preferred_shipping_method_code) REFERENCES shipping_methods(code) ON UPDATE CASCADE ON DELETE RESTRICT;

INSERT INTO categories(name,slug,description,sort_order,is_active) VALUES
('Electronics','electronics','Phones, gadgets, and accessories',1,TRUE),('Fashion','fashion','Clothing, shoes, and accessories',2,TRUE),('Home & Living','home-living','Furniture, decor, and appliances',3,TRUE),('Beauty','beauty','Skincare, makeup, and wellness',4,TRUE),('Sports','sports','Fitness, outdoor, and sports gear',5,TRUE)
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,sort_order=EXCLUDED.sort_order,is_active=EXCLUDED.is_active,updated_at=NOW();

WITH c AS (SELECT id,slug FROM categories)
INSERT INTO subcategories(category_id,name,slug,sort_order) VALUES
((SELECT id FROM c WHERE slug='electronics'),'Smartphones','smartphones',1),((SELECT id FROM c WHERE slug='electronics'),'Laptops','laptops',2),((SELECT id FROM c WHERE slug='fashion'),'Men Clothing','men-clothing',1),((SELECT id FROM c WHERE slug='fashion'),'Women Clothing','women-clothing',2),((SELECT id FROM c WHERE slug='home-living'),'Kitchen Appliances','kitchen-appliances',1),((SELECT id FROM c WHERE slug='beauty'),'Skincare','skincare',1),((SELECT id FROM c WHERE slug='sports'),'Fitness Equipment','fitness-equipment',1)
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order,updated_at=NOW();

INSERT INTO homepage_sections(section_key,title,subtitle,is_active,config) VALUES
('hero','Deal Bazaar Mega Savings','Trusted products at great value',TRUE,'{"showSearch":true}'::jsonb),('featured_categories','Featured Categories','Top shopping destinations',TRUE,'{"limit":8}'::jsonb),('new_arrivals','New Arrivals','Fresh picks every week',TRUE,'{"limit":12}'::jsonb),('best_sellers','Best Sellers','Most loved products',TRUE,'{"limit":12}'::jsonb)
ON CONFLICT(section_key) DO UPDATE SET title=EXCLUDED.title,subtitle=EXCLUDED.subtitle,is_active=EXCLUDED.is_active,config=EXCLUDED.config,updated_at=NOW();

INSERT INTO site_settings(setting_group,setting_key,setting_value,is_public,description) VALUES
('general','site_name','"Deal Bazaar"'::jsonb,TRUE,'Main website name'),
('general','site_tagline','"Trusted deals, delivered fast"'::jsonb,TRUE,'Public tagline'),
('contact','support_email','"support@dealbazaar.com"'::jsonb,TRUE,'Customer support email'),
('contact','support_phone','"+94 11 000 0000"'::jsonb,TRUE,'Customer support number'),
('checkout','tax_rate_percentage','8'::jsonb,FALSE,'Default VAT percentage'),
('checkout','allow_guest_checkout','true'::jsonb,FALSE,'Enable or disable guest checkout'),
('payment','cash_on_delivery_enabled','false'::jsonb,FALSE,'COD disabled initially'),
('payment','bank_transfer_enabled','true'::jsonb,FALSE,'Enable bank transfer payment flow'),
('payment','card_payment_enabled','true'::jsonb,FALSE,'Enable card payment flow'),
('payment','card_payment_provider','"SANDBOX"'::jsonb,FALSE,'Card payment provider mode'),
('localization','default_language','"en"'::jsonb,TRUE,'Default locale'),
('localization','enabled_languages','["en","si"]'::jsonb,TRUE,'Supported interface languages'),
('localization','default_currency','"LKR"'::jsonb,TRUE,'Default display currency')
ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,is_public=EXCLUDED.is_public,description=EXCLUDED.description,updated_at=NOW();

-- Schema verification snapshot (expected base tables: 51)
DO $$
DECLARE
  expected_count INT := 51;
  actual_count INT;
BEGIN
  SELECT COUNT(*) INTO actual_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN (
      'supported_currencies','users','user_profiles','admins','sellers',
      'seller_payout_accounts','seller_payouts','user_sessions','email_verification_tokens',
      'password_reset_tokens','otp_codes','categories','subcategories','brands',
      'product_tags','products','product_images','product_videos','product_attributes',
      'product_attribute_values','product_variants','product_variant_attribute_values',
      'product_tag_map','carts','cart_items','saved_cart_items','wishlists',
      'wishlist_items','compare_lists','compare_items','addresses','shipping_methods',
      'coupons','orders','order_items','order_status_history','payments',
      'payment_webhook_events','payment_proofs','coupon_usages','reviews',
      'review_images','notifications','banners','homepage_sections','inventory_logs',
      'currency_rates','site_settings','audit_logs','newsletter_subscribers','shipments'
    );

  IF actual_count <> expected_count THEN
    RAISE WARNING 'Deal Bazaar schema check: expected % tables, found %.', expected_count, actual_count;
  ELSE
    RAISE NOTICE 'Deal Bazaar schema check: %/% tables present.', actual_count, expected_count;
  END IF;
END $$;
COMMIT;

