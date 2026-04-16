import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2, ChevronDown } from "lucide-react";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { GoogleGenAI, Type } from "@google/genai";
import { toast } from "sonner";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface SalaryData {
  [key: string]: string | number;
}

export function SalaryReview() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [results, setResults] = useState<SalaryData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const processFile = async (file: File | Blob, fileName: string): Promise<SalaryData | null> => {
    try {
      let base64Data = "";
      let mimeType = "";

      if (fileName.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
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
            text: "Extract all salary components from this payslip. Return a flat JSON object where keys are the component names (e.g., Basic, HRA, PF, Net Salary, Month, Year) and values are the amounts or text. Ensure all columns/fields present in the payslip are captured. Return ONLY the JSON object.",
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      let text = response.text;
      // Robust JSON extraction
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { ...JSON.parse(jsonMatch[0]), filename: fileName };
      }
      return null;
    } catch (err) {
      console.error(`Error processing ${fileName}:`, err);
      return null;
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setCurrentFileName("");
    setError(null);
    setResults([]);
    setColumns([]);
    abortRef.current = false;

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const entries: { name: string; blob: Promise<Blob> }[] = [];

      contents.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && zipEntry.name.toLowerCase().match(/\.(pdf|png|jpg|jpeg)$/)) {
          entries.push({
            name: zipEntry.name,
            blob: zipEntry.async("blob"),
          });
        }
      });

      // Sort files by name
      entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      if (entries.length === 0) {
        throw new Error("No valid payslip files (PDF/Image) found in the zip.");
      }

      const validResults: SalaryData[] = [];
      const CONCURRENCY_LIMIT = 3;
      let completedCount = 0;
      const totalFiles = entries.length;
      
      // Create a copy of entries to work with as a queue
      const queue = [...entries];
      
      const processQueue = async () => {
        while (queue.length > 0 && !abortRef.current) {
          const entry = queue.shift();
          if (!entry) break;

          setCurrentFileName(entry.name);
          
          const blob = await entry.blob;
          const data = await processFile(blob, entry.name);
          if (data) {
            validResults.push(data);
          }
          
          completedCount++;
          setProcessingProgress(Math.round((completedCount / totalFiles) * 100));
        }
      };

      // Start parallel workers
      const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, totalFiles) }).map(() => processQueue());
      await Promise.all(workers);

      if (abortRef.current && validResults.length === 0) {
        setIsProcessing(false);
        return;
      }

      setProcessingProgress(100);
      setCurrentFileName(abortRef.current ? "Cancelled" : "Processing complete");

      if (validResults.length === 0) {
        throw new Error("Failed to extract data from any of the files.");
      }

      // Extract all unique columns
      const allKeys = new Set<string>();
      validResults.forEach((res) => {
        Object.keys(res).forEach((key) => allKeys.add(key));
      });

      const cols = Array.from(allKeys);
      setColumns(cols);
      setSelectedColumns(cols); // Default to all columns
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
              <div className="mt-6 w-full max-w-md space-y-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="truncate max-w-[200px]">Reviewing: {currentFileName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{processingProgress}%</span>
                    {processingProgress < 100 && !abortRef.current && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          abortRef.current = true;
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-in-out" 
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground animate-pulse">
                  {abortRef.current ? "Stopping..." : "Processing payslips with AI..."}
                </p>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Salary Review Table</CardTitle>
                <CardDescription>Extracted components from your uploaded payslips.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-2">
                      <Settings2 className="h-4 w-4" />
                      Columns
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-4 border-b">
                      <h4 className="font-medium text-sm">Select Columns</h4>
                      <p className="text-xs text-muted-foreground">Choose which fields to display in the table.</p>
                    </div>
                    <ScrollArea className="h-[300px] p-4">
                      <div className="space-y-3">
                        {columns.map((col) => (
                          <div key={col} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`col-${col}`} 
                              checked={selectedColumns.includes(col)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedColumns([...selectedColumns, col]);
                                } else {
                                  setSelectedColumns(selectedColumns.filter(c => c !== col));
                                }
                              }}
                            />
                            <label
                              htmlFor={`col-${col}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {col}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="p-2 border-t bg-muted/50 flex justify-between">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-[10px] h-7"
                        onClick={() => setSelectedColumns(columns)}
                      >
                        Select All
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-[10px] h-7"
                        onClick={() => setSelectedColumns(['filename'])}
                      >
                        Clear All
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-medium border border-emerald-100">
                  <CheckCircle2 className="h-3 w-3" />
                  {results.length} Payslips
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.filter(col => selectedColumns.includes(col)).map((col) => (
                      <TableHead key={col} className="whitespace-nowrap font-bold">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.filter(col => selectedColumns.includes(col)).map((col) => (
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
