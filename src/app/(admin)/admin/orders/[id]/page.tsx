import { AdminOrderDetailManager } from "@/components/admin/order-detail-manager";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  return <AdminOrderDetailManager orderId={id} />;
}
