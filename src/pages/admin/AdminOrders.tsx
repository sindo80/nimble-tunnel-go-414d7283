import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Eye, CreditCard, User, Mail, Phone, MapPin, Package, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderItem, OrderStatus } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns-jalali";

const statusMap: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "در انتظار تأیید", color: "bg-yellow-100 text-yellow-800" },
  paid: { label: "پرداخت شده", color: "bg-blue-100 text-blue-800" },
  processing: { label: "در حال پردازش", color: "bg-purple-100 text-purple-800" },
  shipped: { label: "ارسال شده", color: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "تحویل داده شده", color: "bg-green-100 text-green-800" },
  cancelled: { label: "لغو شده", color: "bg-red-100 text-red-800" },
};

interface OrderWithItems extends Order {
  order_items?: OrderItem[];
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items(*)`)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "خطا", description: error.message, variant: "destructive" });
    } else {
      setOrders((data || []) as OrderWithItems[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      toast({ title: "خطا", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "موفق", description: "وضعیت سفارش به‌روزرسانی شد" });
      fetchOrders();
    }
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('fa-IR').format(price);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">مدیریت سفارشات و واریزی‌ها</h1>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">شماره سفارش</TableHead>
                  <TableHead className="text-right">نام خریدار</TableHead>
                  <TableHead className="text-right">ایمیل</TableHead>
                  <TableHead className="text-right">تاریخ</TableHead>
                  <TableHead className="text-right">مبلغ</TableHead>
                  <TableHead className="text-right">کد پیگیری</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                  <TableHead className="text-right">جزئیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      هیچ سفارشی یافت نشد
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.order_number}</TableCell>
                      <TableCell>{(order as any).payer_name || "-"}</TableCell>
                      <TableCell dir="ltr" className="text-left text-xs">{(order as any).email || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(order.created_at), 'yyyy/MM/dd - HH:mm')}
                      </TableCell>
                      <TableCell className="font-semibold">{formatPrice(order.final_amount)} <span className="text-xs text-muted-foreground">تومان</span></TableCell>
                      <TableCell dir="ltr" className="text-left font-mono text-xs">{order.payment_reference || "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={(value: OrderStatus) => handleStatusChange(order.id, value)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue>
                              <Badge className={statusMap[order.status].color}>
                                {statusMap[order.status].label}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusMap).map(([key, { label }]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Order Detail Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                جزئیات سفارش {selectedOrder?.order_number}
              </DialogTitle>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-4">
                {/* Buyer info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> اطلاعات خریدار</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">نام:</span>
                      <span className="font-semibold">{(selectedOrder as any).payer_name || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">ایمیل:</span>
                      <span className="font-semibold" dir="ltr">{(selectedOrder as any).email || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">تلفن:</span>
                      <span className="font-semibold" dir="ltr">{selectedOrder.phone || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">شهر:</span>
                      <span className="font-semibold">{selectedOrder.shipping_city || "-"}</span>
                    </div>
                    <div className="col-span-2 flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">آدرس:</span>
                      <span className="font-semibold">{selectedOrder.shipping_address || "-"}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment info */}
                <Card className="border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> اطلاعات واریز</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">مبلغ واریز:</span>
                      <span className="font-bold text-primary">{formatPrice(selectedOrder.final_amount)} تومان</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">شماره کارت واریزکننده:</span>
                      <span className="font-mono font-semibold" dir="ltr">{(selectedOrder as any).payer_card_number || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">شماره پیگیری:</span>
                      <span className="font-mono font-semibold" dir="ltr">{selectedOrder.payment_reference || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاریخ ثبت:</span>
                      <span>{format(new Date(selectedOrder.created_at), 'yyyy/MM/dd - HH:mm')}</span>
                    </div>
                    {selectedOrder.notes && (
                      <div className="pt-2">
                        <span className="text-muted-foreground">توضیحات:</span>
                        <p className="mt-1 bg-muted rounded p-2">{selectedOrder.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Order items */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> محصولات سفارش</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedOrder.order_items?.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                          <div>
                            <span className="font-semibold">{item.product_name}</span>
                            <Badge variant="outline" className="mr-2 text-xs">
                              {item.product_type === 'digital' ? 'دیجیتال' : 'فیزیکی'}
                            </Badge>
                          </div>
                          <div className="text-left">
                            <span>{formatPrice(item.total_price)} تومان</span>
                            {item.quantity > 1 && <span className="text-xs text-muted-foreground block">{item.quantity} × {formatPrice(item.unit_price)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between font-bold">
                      <span>مبلغ کل</span>
                      <span className="text-primary">{formatPrice(selectedOrder.final_amount)} تومان</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
