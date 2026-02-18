import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, User, Mail, Phone, MapPin, FileText, CheckCircle, Copy, Upload, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Layout } from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/database';
import { toast } from 'sonner';
import { z } from 'zod';

const checkoutSchema = z.object({
  fullName: z.string().trim().min(3, 'نام و نام خانوادگی الزامی است').max(100),
  email: z.string().trim().email('ایمیل معتبر وارد کنید').max(255),
  phone: z.string().trim().min(10, 'شماره تماس الزامی است').max(15),
  address: z.string().trim().min(5, 'آدرس الزامی است').max(500),
  city: z.string().trim().min(2, 'شهر الزامی است').max(100),
  postalCode: z.string().trim().min(5, 'کد پستی الزامی است').max(20),
  payerCardNumber: z.string().trim().min(12, 'شماره کارت واریزکننده الزامی است').max(20),
  paymentReference: z.string().trim().min(4, 'شماره پیگیری الزامی است').max(50),
  notes: z.string().max(500).optional(),
});

const CARD_NUMBER = '6219861992773191';
const CARD_HOLDER = 'سینا خسروی';

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, totalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'payment' | 'done'>('info');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    payerCardNumber: '',
    paymentReference: '',
    notes: '',
  });

  const formatPrice = (price: number) => new Intl.NumberFormat('fa-IR').format(price);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateInfo = () => {
    const result = checkoutSchema.pick({
      fullName: true, email: true, phone: true, address: true, city: true, postalCode: true,
    }).safeParse(form);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { newErrors[e.path[0] as string] = e.message; });
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حداکثر حجم فایل ۵ مگابایت است');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('فقط فایل تصویری مجاز است');
      return;
    }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleSubmitOrder = async () => {
    const result = checkoutSchema.safeParse(form);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { newErrors[e.path[0] as string] = e.message; });
      setErrors(newErrors);
      return;
    }

    if (!user) { toast.error('لطفاً وارد شوید'); return; }
    setLoading(true);

    try {
      // Upload receipt image if provided
      let receiptImageUrl: string | null = null;
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(filePath, receiptFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(filePath);
        receiptImageUrl = urlData.publicUrl;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: 'ORD-TEMP',
          total_amount: totalPrice,
          final_amount: totalPrice,
          shipping_address: form.address,
          shipping_city: form.city,
          shipping_postal_code: form.postalCode,
          phone: form.phone,
          email: form.email,
          payer_card_number: form.payerCardNumber,
          payer_name: form.fullName,
          payment_reference: form.paymentReference,
          receipt_image_url: receiptImageUrl,
          notes: form.notes || null,
          status: 'pending' as const,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => {
        const product = item.product as Product;
        return {
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          product_type: product.product_type as 'digital' | 'physical',
          quantity: item.quantity,
          unit_price: product.discount_price || product.price,
          total_price: (product.discount_price || product.price) * item.quantity,
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await clearCart();
      setStep('done');
      toast.success('سفارش شما با موفقیت ثبت شد');
    } catch (err: any) {
      toast.error('خطا در ثبت سفارش: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const copyCard = () => {
    navigator.clipboard.writeText(CARD_NUMBER);
    toast.success('شماره کارت کپی شد');
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (items.length === 0 && step !== 'done') {
    navigate('/cart');
    return null;
  }

  if (step === 'done') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center max-w-lg">
          <CheckCircle className="h-20 w-20 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-3">سفارش شما ثبت شد!</h1>
          <p className="text-muted-foreground mb-6">
            سفارش شما پس از تأیید واریز، پردازش خواهد شد. از طریق پنل کاربری می‌توانید وضعیت سفارش را پیگیری کنید.
          </p>
          <Button onClick={() => navigate('/products')}>بازگشت به محصولات</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">تکمیل خرید</h1>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step === 'info' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 'info' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>۱</div>
            اطلاعات
          </div>
          <div className="w-12 h-px bg-border" />
          <div className={`flex items-center gap-2 ${step === 'payment' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 'payment' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>۲</div>
            پرداخت
          </div>
        </div>

        {step === 'info' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> اطلاعات خریدار</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>نام و نام خانوادگی *</Label>
                  <Input value={form.fullName} onChange={e => handleChange('fullName', e.target.value)} placeholder="سینا خسروی" />
                  {errors.fullName && <p className="text-destructive text-xs mt-1">{errors.fullName}</p>}
                </div>
                <div>
                  <Label>ایمیل *</Label>
                  <Input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="email@example.com" dir="ltr" />
                  {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label>شماره تماس *</Label>
                  <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="09123456789" dir="ltr" />
                  {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <Label>شهر *</Label>
                  <Input value={form.city} onChange={e => handleChange('city', e.target.value)} placeholder="تهران" />
                  {errors.city && <p className="text-destructive text-xs mt-1">{errors.city}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>آدرس کامل *</Label>
                  <Textarea value={form.address} onChange={e => handleChange('address', e.target.value)} placeholder="آدرس کامل پستی" />
                  {errors.address && <p className="text-destructive text-xs mt-1">{errors.address}</p>}
                </div>
                <div>
                  <Label>کد پستی *</Label>
                  <Input value={form.postalCode} onChange={e => handleChange('postalCode', e.target.value)} placeholder="1234567890" dir="ltr" />
                  {errors.postalCode && <p className="text-destructive text-xs mt-1">{errors.postalCode}</p>}
                </div>
              </div>

              <Separator />

              {/* Order summary */}
              <div className="space-y-2">
                <h3 className="font-semibold">خلاصه سفارش</h3>
                {items.map(item => {
                  const product = item.product as Product;
                  if (!product) return null;
                  return (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{product.name} × {item.quantity}</span>
                      <span>{formatPrice((product.discount_price || product.price) * item.quantity)} تومان</span>
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>مبلغ قابل پرداخت</span>
                  <span className="text-primary">{formatPrice(totalPrice)} تومان</span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={() => { if (validateInfo()) setStep('payment'); }}>
                ادامه به مرحله پرداخت
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'payment' && (
          <div className="space-y-6">
            {/* Card info */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> اطلاعات کارت برای واریز</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-3">
                  <p className="text-lg font-bold text-primary">{formatPrice(totalPrice)} تومان</p>
                  <div className="bg-background rounded-xl p-4 border">
                    <p className="text-sm text-muted-foreground mb-1">شماره کارت</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl font-mono font-bold tracking-widest" dir="ltr">{CARD_NUMBER}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyCard}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">به نام: <span className="font-semibold text-foreground">{CARD_HOLDER}</span></p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    لطفاً مبلغ فوق را به شماره کارت بالا واریز کرده و اطلاعات زیر را تکمیل کنید
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payment confirmation form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> تأیید واریز</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>شماره کارت واریزکننده *</Label>
                  <Input value={form.payerCardNumber} onChange={e => handleChange('payerCardNumber', e.target.value)} placeholder="شماره کارتی که از آن واریز کردید" dir="ltr" />
                  {errors.payerCardNumber && <p className="text-destructive text-xs mt-1">{errors.payerCardNumber}</p>}
                </div>
                <div>
                  <Label>شماره پیگیری / شماره مرجع *</Label>
                  <Input value={form.paymentReference} onChange={e => handleChange('paymentReference', e.target.value)} placeholder="شماره پیگیری تراکنش" dir="ltr" />
                  {errors.paymentReference && <p className="text-destructive text-xs mt-1">{errors.paymentReference}</p>}
                </div>
                <div>
                  <Label>تصویر فیش واریزی (اختیاری)</Label>
                  <div className="mt-1">
                    {receiptPreview ? (
                      <div className="relative">
                        <img src={receiptPreview} alt="فیش واریزی" className="w-full max-h-64 object-contain rounded-lg border" />
                        <Button variant="destructive" size="sm" className="absolute top-2 left-2" onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}>
                          حذف
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">آپلود تصویر فیش واریزی</span>
                        <span className="text-xs text-muted-foreground mt-1">حداکثر ۵ مگابایت</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <Label>توضیحات (اختیاری)</Label>
                  <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="توضیحات اضافی..." />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('info')} className="flex-1">بازگشت</Button>
                  <Button onClick={handleSubmitOrder} disabled={loading} className="flex-1" size="lg">
                    {loading ? 'در حال ثبت...' : 'ثبت نهایی سفارش'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
