import { redirect } from "next/navigation";

export default function CourierHomeRedirect() {
  redirect("/repartidor/pedidos");
}
