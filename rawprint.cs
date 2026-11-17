// rawprint.exe <nama printer> <file> : kirim byte ESC/POS apa adanya ke printer Windows (USB) tanpa dialog cetak.
// Dikompilasi otomatis oleh GitHub Actions (csc.exe bawaan Windows).
using System;
using System.IO;
using System.Runtime.InteropServices;

class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string name, out IntPtr h, IntPtr def);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern int StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);

  static int Main(string[] a) {
    if (a.Length < 2) { Console.Error.WriteLine("pakai: rawprint <printer> <file>"); return 2; }
    byte[] b;
    try { b = File.ReadAllBytes(a[1]); } catch (Exception e) { Console.Error.WriteLine("File cetak tidak terbaca: " + e.Message); return 2; }
    IntPtr h;
    if (!OpenPrinter(a[0], out h, IntPtr.Zero)) { Console.Error.WriteLine("Printer tidak ditemukan di Windows: " + a[0]); return 3; }
    try {
      // RAW untuk driver biasa; XPS_PASS untuk driver Windows model baru (v4)
      int job = StartDocPrinter(h, 1, new DOCINFO { pDocName = "RB POS", pDataType = "RAW" });
      if (job == 0) job = StartDocPrinter(h, 1, new DOCINFO { pDocName = "RB POS", pDataType = "XPS_PASS" });
      if (job == 0) { Console.Error.WriteLine("Printer menolak pekerjaan cetak (kode " + Marshal.GetLastWin32Error() + ")"); return 4; }
      StartPagePrinter(h);
      int w;
      bool ok = WritePrinter(h, b, b.Length, out w);
      EndPagePrinter(h);
      EndDocPrinter(h);
      if (!ok || w != b.Length) { Console.Error.WriteLine("Gagal kirim ke printer (kode " + Marshal.GetLastWin32Error() + ")"); return 5; }
      return 0;
    } finally { ClosePrinter(h); }
  }
}
