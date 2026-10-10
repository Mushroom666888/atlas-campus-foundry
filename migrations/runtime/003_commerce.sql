CREATE TABLE commerce_shops (
 id text PRIMARY KEY, owner_id text NOT NULL UNIQUE REFERENCES accounts(id),
 name text NOT NULL, description text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commerce_products (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES commerce_shops(id),
 title text NOT NULL, description text NOT NULL, category text NOT NULL,
 price_cents integer NOT NULL CHECK(price_cents>0), stock integer NOT NULL CHECK(stock>=0),
 image_id text REFERENCES uploads(id), status text NOT NULL CHECK(status IN ('active','paused')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commerce_products_shop ON commerce_products(shop_id);
CREATE TABLE commerce_coupons (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES commerce_shops(id), code text NOT NULL,
 discount_cents integer NOT NULL CHECK(discount_cents>0), minimum_cents integer NOT NULL CHECK(minimum_cents>=0),
 max_uses integer NOT NULL CHECK(max_uses>0), uses integer NOT NULL DEFAULT 0 CHECK(uses>=0 AND uses<=max_uses),
 expires_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true, UNIQUE(shop_id,code)
);
CREATE TABLE commerce_orders (
 id text PRIMARY KEY, buyer_id text NOT NULL REFERENCES accounts(id), seller_id text NOT NULL REFERENCES accounts(id),
 product_id text NOT NULL REFERENCES commerce_products(id), title text NOT NULL, quantity integer NOT NULL CHECK(quantity>0),
 unit_price_cents integer NOT NULL, subtotal_cents integer NOT NULL, discount_cents integer NOT NULL,
 total_cents integer NOT NULL CHECK(total_cents>=0), coupon_id text REFERENCES commerce_coupons(id),
 status text NOT NULL CHECK(status IN ('placed','accepted','ready','completed','cancelled')),
 fulfillment_note text NOT NULL DEFAULT '', request_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(buyer_id,request_key)
);
CREATE INDEX commerce_orders_parties ON commerce_orders(seller_id,buyer_id,created_at DESC);
CREATE TABLE commerce_services (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES commerce_shops(id),
 title text NOT NULL, description text NOT NULL, price_cents integer NOT NULL CHECK(price_cents>=0),
 starts_at timestamptz NOT NULL, capacity integer NOT NULL CHECK(capacity>0),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed'))
);
CREATE TABLE commerce_bookings (
 id text PRIMARY KEY, service_id text NOT NULL REFERENCES commerce_services(id), user_id text NOT NULL REFERENCES accounts(id),
 price_cents integer NOT NULL, status text NOT NULL CHECK(status IN ('booked','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(service_id,user_id)
);
CREATE TABLE commerce_reviews (
 id text PRIMARY KEY, order_id text NOT NULL UNIQUE REFERENCES commerce_orders(id), author_id text NOT NULL REFERENCES accounts(id),
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commerce_favorites (
 product_id text NOT NULL REFERENCES commerce_products(id), user_id text NOT NULL REFERENCES accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(product_id,user_id)
);
