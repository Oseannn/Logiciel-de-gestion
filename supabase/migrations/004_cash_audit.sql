-- Cash register table
CREATE TABLE public.cash_register (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendeuse_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  initial_amount DECIMAL(10,2) NOT NULL CHECK (initial_amount >= 0),
  final_amount DECIMAL(10,2) CHECK (final_amount >= 0),
  expected_amount DECIMAL(10,2) CHECK (expected_amount >= 0),
  difference DECIMAL(10,2),
  sales_total DECIMAL(10,2) DEFAULT 0 CHECK (sales_total >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash withdrawals table
CREATE TABLE public.cash_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_register_id UUID REFERENCES public.cash_register(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refunds table
CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES public.sales(id),
  refund_amount DECIMAL(10,2) NOT NULL CHECK (refund_amount > 0),
  reason TEXT NOT NULL,
  type TEXT CHECK (type IN ('FULL', 'PARTIAL')),
  refunded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Policies for cash register
CREATE POLICY "Vendeuses can manage their own cash register"
  ON public.cash_register FOR ALL
  USING (
    vendeuse_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Policies for withdrawals
CREATE POLICY "Users can view withdrawals"
  ON public.cash_withdrawals FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Policies for audit logs (admin only)
CREATE POLICY "Admin can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies for refunds
CREATE POLICY "Admin can manage refunds"
  ON public.refunds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_cash_register_vendeuse ON public.cash_register(vendeuse_id);
CREATE INDEX idx_cash_register_status ON public.cash_register(status);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_category ON public.audit_logs(category);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
