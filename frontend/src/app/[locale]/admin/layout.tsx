import { Footer } from "@/components/footer";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">
        {children}
      </div>
      <Footer />
    </div>
  );
}
