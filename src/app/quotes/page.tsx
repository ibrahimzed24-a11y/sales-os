'use client';

import { useState } from 'react';
import { Eye, Plus, Printer, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn, dateInput, fmtDate, money, num, uid } from '@/lib/utils';
import { Badge, Button, Card, FormModal, inputCls, Modal, PageHeader } from '@/components/ui';
import type { BillingCycle, Product, ProductKind, Quote, QuoteItem, QuoteStatus } from '@/types/sales-os';

function calcQuote(items: QuoteItem[], taxRate: number) {
  const subtotal = items.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const discounts = items.reduce((a, l) => a + l.quantity * l.unitPrice * (l.discount / 100), 0);
  const net = subtotal - discounts;
  const tax = net * (taxRate / 100);
  return { subtotal, discounts, tax, total: Math.round(net + tax) };
}

const statusTone = (s: QuoteStatus) => (s === 'Accepted' ? 'green' : s === 'Declined' ? 'red' : s === 'Sent' ? 'blue' : 'slate');

export default function QuotesPage() {
  const quotes = useStore((s) => s.quotes);
  const products = useStore((s) => s.products);
  const deals = useStore((s) => s.deals);
  const accounts = useStore((s) => s.accounts);
  const currency = useStore((s) => s.settings.currency);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const [tab, setTab] = useState<'quotes' | 'catalog'>('quotes');
  const [building, setBuilding] = useState<Quote | 'new' | null>(null);
  const [preview, setPreview] = useState<Quote | null>(null);
  const [product, setProduct] = useState<Product | 'new' | null>(null);

  const dealName = (id: string) => deals.find((d) => d.id === id)?.title ?? '—';

  return (
    <>
      <PageHeader
        title="Quotes & Catalog"
        actions={
          <>
            <Button variant={tab === 'quotes' ? 'primary' : 'outline'} onClick={() => setTab('quotes')}>Quotes</Button>
            <Button variant={tab === 'catalog' ? 'primary' : 'outline'} onClick={() => setTab('catalog')}>Product catalog</Button>
            {tab === 'quotes' ? (
              <Button onClick={() => setBuilding('new')}><Plus size={14} /> New quote</Button>
            ) : (
              <Button onClick={() => setProduct('new')}><Plus size={14} /> New product</Button>
            )}
          </>
        }
      />
      {tab === 'quotes' ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>{['Quote', 'Deal', 'Status', 'Total (TCV)', 'Valid until', ''].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{q.id.toUpperCase()}</td>
                  <td className="px-3 py-2">{dealName(q.dealId)}</td>
                  <td className="px-3 py-2"><Badge tone={statusTone(q.status)}>{q.status}</Badge></td>
                  <td className="px-3 py-2">{money(q.totalAmount, currency)}</td>
                  <td className="px-3 py-2">{fmtDate(q.validUntil)}</td>
                  <td className="flex gap-1 px-3 py-2">
                    <Button variant="ghost" aria-label="Preview" onClick={() => setPreview(q)}><Eye size={14} /></Button>
                    <Button variant="ghost" onClick={() => setBuilding(q)}>Edit</Button>
                    <Button variant="ghost" aria-label="Delete" onClick={() => { if (window.confirm('Delete this quote?')) remove('quotes', q.id); }}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">No quotes yet</td></tr>}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>{['SKU', 'Name', 'Type', 'Billing', 'Base price'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} onClick={() => setProduct(p)} className="cursor-pointer border-t border-line hover:bg-raised">
                  <td className="px-3 py-2">{p.sku}</td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2"><Badge tone={p.kind === 'recurring' ? 'green' : 'slate'}>{p.kind === 'recurring' ? (p.billingCycle === 'annual' ? 'ARR' : 'MRR') : 'One-time'}</Badge></td>
                  <td className="px-3 py-2">{p.billingCycle}</td>
                  <td className="px-3 py-2">{money(p.basePrice, currency)}</td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted">No products yet</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {building && <QuoteBuilder quote={building === 'new' ? undefined : building} onClose={() => setBuilding(null)} />}
      {preview && (
        <Modal title="Quote preview" wide onClose={() => setPreview(null)}>
          <div className="print-area rounded-md bg-white p-6 text-slate-900">
            <h2 className="text-2xl font-bold">Quote {preview.id.toUpperCase()}</h2>
            <p className="text-sm text-slate-600">
              {dealName(preview.dealId)} · {accounts.find((a) => a.id === deals.find((d) => d.id === preview.dealId)?.accountId)?.name ?? ''}
            </p>
            <p className="mb-4 text-sm text-slate-600">Valid until {fmtDate(preview.validUntil)} · Status: {preview.status}</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-1">Item</th><th>Qty</th><th>Unit</th><th>Disc.</th><th className="text-right">Line total</th></tr></thead>
              <tbody>
                {preview.items.map((l, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1">{l.name}</td><td>{l.quantity}</td><td>{money(l.unitPrice, currency)}</td><td>{l.discount}%</td>
                    <td className="text-right">{money(l.quantity * l.unitPrice * (1 - l.discount / 100), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(() => {
              const c = calcQuote(preview.items, preview.taxRate);
              return (
                <div className="mt-4 ml-auto w-60 space-y-1 text-sm">
                  <p className="flex justify-between"><span>Subtotal</span><span>{money(c.subtotal, currency)}</span></p>
                  <p className="flex justify-between"><span>Discounts</span><span>-{money(c.discounts, currency)}</span></p>
                  <p className="flex justify-between"><span>Tax ({preview.taxRate}%)</span><span>{money(c.tax, currency)}</span></p>
                  <p className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{money(c.total, currency)}</span></p>
                </div>
              );
            })()}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => void navigator.clipboard.writeText(`Quote ${preview.id.toUpperCase()} - ${dealName(preview.dealId)} - Total ${money(preview.totalAmount, currency)} (valid until ${fmtDate(preview.validUntil)})`)}>Copy summary</Button>
            <Button onClick={() => window.print()}><Printer size={14} /> Print</Button>
          </div>
        </Modal>
      )}
      {product && (
        <FormModal
          title={product === 'new' ? 'New product' : 'Edit product'}
          onClose={() => setProduct(null)}
          fields={[
            { key: 'sku', label: 'SKU', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'recurring', label: 'Recurring (MRR/ARR)' }, { value: 'one-time', label: 'One-time' }] },
            { key: 'billingCycle', label: 'Billing cycle', type: 'select', options: [{ value: 'monthly', label: 'monthly' }, { value: 'annual', label: 'annual' }, { value: 'one-time', label: 'one-time' }] },
            { key: 'basePrice', label: 'Base price', type: 'number', required: true },
          ]}
          initial={{
            sku: product === 'new' ? '' : product.sku,
            name: product === 'new' ? '' : product.name,
            kind: product === 'new' ? 'recurring' : product.kind,
            billingCycle: product === 'new' ? 'monthly' : product.billingCycle,
            basePrice: product === 'new' ? '' : String(product.basePrice),
          }}
          onSubmit={(v) => {
            upsert('products', {
              id: product === 'new' ? uid('prod') : product.id,
              sku: v.sku,
              name: v.name,
              kind: v.kind as ProductKind,
              billingCycle: v.billingCycle as BillingCycle,
              basePrice: num(v.basePrice),
            });
            setProduct(null);
          }}
          onDelete={product === 'new' ? undefined : () => { remove('products', product.id); setProduct(null); }}
        />
      )}
    </>
  );
}

function QuoteBuilder({ quote, onClose }: { quote?: Quote; onClose: () => void }) {
  const deals = useStore((s) => s.deals);
  const products = useStore((s) => s.products);
  const currency = useStore((s) => s.settings.currency);
  const upsert = useStore((s) => s.upsert);
  const [dealId, setDealId] = useState(quote?.dealId ?? deals[0]?.id ?? '');
  const [status, setStatus] = useState<QuoteStatus>(quote?.status ?? 'Draft');
  const [validUntil, setValidUntil] = useState(dateInput(quote?.validUntil) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [taxRate, setTaxRate] = useState(quote?.taxRate ?? 0);
  const [items, setItems] = useState<QuoteItem[]>(quote?.items ?? []);
  const [pick, setPick] = useState(products[0]?.id ?? '');
  const calc = calcQuote(items, taxRate);

  const addItem = () => {
    const p = products.find((x) => x.id === pick);
    if (p) setItems([...items, { productId: p.id, name: p.name, quantity: 1, unitPrice: p.basePrice, discount: 0 }]);
  };
  const patch = (i: number, change: Partial<QuoteItem>) => setItems(items.map((l, idx) => (idx === i ? { ...l, ...change } : l)));

  return (
    <Modal title={quote ? 'Edit quote' : 'Quote builder'} wide onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted">Deal</span>
          <select className={inputCls} value={dealId} onChange={(e) => setDealId(e.target.value)}>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-muted">Status</span>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
            {(['Draft', 'Sent', 'Accepted', 'Declined'] as QuoteStatus[]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-muted">Valid until</span>
          <input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-muted">Tax %</span>
          <input type="number" className={inputCls} value={taxRate} onChange={(e) => setTaxRate(num(e.target.value))} />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.basePrice, currency)}</option>)}
        </select>
        <Button type="button" variant="outline" onClick={addItem}>Add line</Button>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((l, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2 text-sm">
            <span className="col-span-4 truncate">{l.name}</span>
            <input aria-label="Quantity" type="number" min={1} className={cn(inputCls, 'col-span-2')} value={l.quantity} onChange={(e) => patch(i, { quantity: Math.max(1, num(e.target.value)) })} />
            <input aria-label="Unit price" type="number" className={cn(inputCls, 'col-span-3')} value={l.unitPrice} onChange={(e) => patch(i, { unitPrice: num(e.target.value) })} />
            <input aria-label="Discount %" type="number" className={cn(inputCls, 'col-span-2')} value={l.discount} onChange={(e) => patch(i, { discount: Math.min(100, Math.max(0, num(e.target.value))) })} />
            <button aria-label="Remove line" className="col-span-1 text-muted hover:text-red-500" onClick={() => setItems(items.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">Add products to build the quote.</p>}
      </div>
      <div className="mt-4 text-right text-sm">
        <p>Subtotal {money(calc.subtotal, currency)} · Discounts -{money(calc.discounts, currency)} · Tax {money(calc.tax, currency)}</p>
        <p className="text-lg font-semibold" data-testid="quote-total">Total contract value: {money(calc.total, currency)}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!dealId || items.length === 0}
          onClick={() => {
            upsert('quotes', {
              id: quote?.id ?? uid('quote'),
              dealId,
              status,
              items,
              taxRate,
              totalAmount: calc.total,
              validUntil,
              createdAt: quote?.createdAt ?? new Date().toISOString(),
            });
            onClose();
          }}
        >
          Save quote
        </Button>
      </div>
    </Modal>
  );
}
