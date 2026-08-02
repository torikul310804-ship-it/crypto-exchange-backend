-- Enums
CREATE TYPE order_type AS ENUM ('LIMIT', 'MARKET');
CREATE TYPE order_side AS ENUM ('BUY', 'SELL');
CREATE TYPE order_status AS ENUM ('PENDING', 'PARTIAL', 'FILLED', 'CANCELLED');

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    deposit_address VARCHAR(42),
    encrypted_private_key TEXT,
    referral_code VARCHAR(10) UNIQUE,
    referred_by UUID REFERENCES users(id),
    is_2fa_enabled BOOLEAN DEFAULT FALSE,
    two_fa_secret VARCHAR(255),
    kyc_status VARCHAR(50) DEFAULT 'PENDING',
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    balance NUMERIC(36, 18) DEFAULT 0.000000000000000000,
    locked_balance NUMERIC(36, 18) DEFAULT 0.000000000000000000,
    UNIQUE(user_id, currency)
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    side order_side NOT NULL,
    type order_type NOT NULL,
    price NUMERIC(36, 18),
    quantity NUMERIC(36, 18) NOT NULL,
    filled_quantity NUMERIC(36, 18) DEFAULT 0,
    status order_status DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Trades Table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    buyer_order_id UUID REFERENCES orders(id),
    seller_order_id UUID REFERENCES orders(id),
    price NUMERIC(36, 18) NOT NULL,
    quantity NUMERIC(36, 18) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Referrals Table
CREATE TABLE IF NOT EXISTS referral_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES users(id),
    referee_id UUID REFERENCES users(id),
    trade_id UUID REFERENCES trades(id),
    currency VARCHAR(10) NOT NULL,
    commission_amount NUMERIC(36, 18) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Deposits Table
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    user_id UUID REFERENCES users(id),
    currency VARCHAR(10) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    block_number BIGINT NOT NULL,
    confirmations INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tx_hash, log_index)
);

-- 7. Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    currency VARCHAR(20) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    to_address VARCHAR(100) NOT NULL,
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'PENDING',
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. KYC Submissions
CREATE TABLE IF NOT EXISTS kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    id_type VARCHAR(50) NOT NULL,
    id_number VARCHAR(100) NOT NULL,
    front_image_url TEXT NOT NULL,
    back_image_url TEXT,
    selfie_image_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Sync State Table
CREATE TABLE IF NOT EXISTS blockchain_sync_state (
    chain_id INT PRIMARY KEY,
    last_scanned_block BIGINT NOT NULL
);

INSERT INTO blockchain_sync_state (chain_id, last_scanned_block) VALUES (1, 19000000) ON CONFLICT DO NOTHING;
INSERT INTO blockchain_sync_state (chain_id, last_scanned_block) VALUES (56, 35000000) ON CONFLICT DO NOTHING;

