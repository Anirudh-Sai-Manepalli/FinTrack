import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import { GoogleGenAI, Type } from "@google/genai";
import { toast } from "sonner";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface SalaryData {
  [key: string]: string | number;
}

export function SalaryReview() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<SalaryData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const processFile = async (file: File | Blob, fileName: string): Promise<SalaryData | null> => {
    try {
      let base64Data = "";
      let mimeType = "";

      if (fileName.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          base64Data = canvas.toDataURL("image/png").split(",")[1];
          mimeType = "image/png";
        }
      } else if (fileName.toLowerCase().match(/\.(png|jpg|jpeg)$/)) {
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        mimeType = file.type || "image/png";
      }

      if (!base64Data) return null;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "Extract all salary components from this payslip. Return a flat JSON object where keys are the component names (e.g., Basic, HRA, PF, Net Salary, Month, Year) and values are the amounts or text. Ensure all columns/fields present in the payslip are captured.",
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      return JSON.parse(response.text);
    } catch (err) {
      console.error(`Error processing ${fileName}:`, err);
      return null;
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);
    setColumns([]);

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const filePromises: Promise<{ data: SalaryData | null; name: string }>[] = [];

      contents.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && zipEntry.name.toLowerCase().match(/\.(pdf|png|jpg|jpeg)$/)) {
          const promise = zipEntry.async("blob").then(async (blob) => {
            const data = await processFile(blob, zipEntry.name);
            return { data, name: zipEntry.name };
          });
          filePromises.push(promise);
        }
      });

      if (filePromises.length === 0) {
        throw new Error("No valid payslip files (PDF/Image) found in the zip.");
      }

      const processedResults = await Promise.all(filePromises);
      const validResults = processedResults
        .map((r) => r.data)
        .filter((d): d is SalaryData => d !== null);

      if (validResults.length === 0) {
        throw new Error("Failed to extract data from any of the files.");
      }

      // Extract all unique columns
      const allKeys = new Set<string>();
      validResults.forEach((res) => {
        Object.keys(res).forEach((key) => allKeys.add(key));
      });

      setColumns(Array.from(allKeys));
      setResults(validResults);
      toast.success(`Successfully processed ${validResults.length} payslips!`);
    } catch (err: any) {
      setError(err.message || "An error occurred while processing the zip file.");
      toast.error("Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-2 bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Upload Payslips Zip</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2 mb-6">
              Upload a ZIP file containing your monthly payslips (PDF or Images).
            </p>
            <div className="w-full max-w-sm">
              <Label htmlFor="zip-upload" className="sr-only">Choose Zip File</Label>
              <Input
                id="zip-upload"
                type="file"
                accept=".zip"
                onChange={handleZipUpload}
                disabled={isProcessing}
                className="cursor-pointer"
              />
            </div>
            {isProcessing && (
              <div className="mt-6 flex items-center gap-2 text-primary font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing payslips with AI...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Salary Review Table</CardTitle>
                <CardDescription>Extracted components from your uploaded payslips.</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-medium border border-emerald-100">
                <CheckCircle2 className="h-3 w-3" />
                {results.length} Payslips Processed
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap font-bold">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap">
                          {row[col] !== undefined ? String(row[col]) : "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
