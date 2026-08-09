import { Link } from "wouter";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Halaman Tidak Ditemukan</h1>
        <p className="text-sm text-gray-500 mt-2 mb-6">
          Halaman yang Anda cari tidak ada atau sudah dipindahkan.
        </p>
        <Link href="/">
          <Button className="bg-amber-600 hover:bg-amber-700">Kembali ke Beranda</Button>
        </Link>
      </div>
    </div>
  );
}
