import { AccountOrderDetail } from "@/components/account/order-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AccountOrderDetailPage({ params }: Props) {
  const { id } = await params;
  return <AccountOrderDetail orderId={id} />;
}
