import { useEffect, useState } from "react";
import axios from "axios";
import {
  User,
  Mail,
  Phone,
  Upload,
  X,
  Edit2,
  Trash2,
  FileText,
  Download,
  ExternalLink,
  Copy,
  CheckCircle,
  Loader2,
  Search,
  Plus,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

const API_BASE = import.meta.env.VITE_API_URL;
const API_URL = `${API_BASE}/api/employees`;

const EmployeePage = () => {
  const [employees, setEmployees] = useState([]);
  const [editId, setEditId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [filesToKeep, setFilesToKeep] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ocrQuota, setOcrQuota] = useState(null);
  const [paidOcrEnabled, setPaidOcrEnabled] = useState(false);
  const [ocrToggleLoading, setOcrToggleLoading] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [ocrCost, setOcrCost] = useState(0);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(API_URL);
      setEmployees(res.data.data || res.data);
      localStorage.setItem(
        "cachedEmployees",
        JSON.stringify(res.data.data || res.data)
      );
    } catch (error) {
      const cached = localStorage.getItem("cachedEmployees");
      if (!cached) {
        console.log(error.message);
      }
      if (cached) setEmployees(JSON.parse(cached));
    }
  };

  const fetchOCRState = async () => {
    try {
      const [quotaRes, paidRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/ocr-quota`),
        axios.get(`${API_BASE}/api/admin/ocr-paid-status`),
      ]);
      setOcrQuota(quotaRes.data);
      setPaidOcrEnabled(paidRes.data.enabled);

      setOcrCost(quotaRes.data.totalPaid.toFixed(2) || 0);
    } catch (err) {
      console.error("Failed to load OCR state", err);
    }
  };

  const handlePaidOcrToggle = async () => {
    try {
      setOcrToggleLoading(true);

      const nextState = !paidOcrEnabled; // 👈 TOGGLE

      const res = await axios.post(`${API_BASE}/api/admin/ocr-toggle-paid`, {
        enabled: nextState,
      });
      console.log(res);
      setPaidOcrEnabled(res.data.enabled);

      if (nextState) {
        alert("Paid OCR enabled. Charges will apply per request.", {
          duration: 4000,
        });
      } else {
        toast.success("Paid OCR disabled.");
      }
      await fetchOCRState();
      return res.data.enabled;
    } catch (error) {
      toast.error(`${error.message}`);
      return paidOcrEnabled;
    } finally {
      setOcrToggleLoading(false);
    }
  };

  const validate = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return false;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Invalid email format");
      return false;
    }
    if (!form.phone.trim()) {
      toast.error("Phone is required");
      return false;
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      toast.error("Phone must be 10 digits");
      return false;
    }
    if (!editId && selectedFiles.length === 0) {
      toast.error("At least one file is required");
      return false;
    }
    if (editId && filesToKeep.length === 0 && selectedFiles.length === 0) {
      toast.error("At least one file is required");
      return false;
    }
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingFile = (index) => {
    const fileToRemove = existingFiles[index];
    setExistingFiles((prev) => prev.filter((_, i) => i !== index));
    setFilesToKeep((prev) =>
      prev.filter((file) => file.url !== fileToRemove.url)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("email", form.email);
    formData.append("phone", form.phone);

    selectedFiles.forEach((file) => formData.append("files", file));
    if (editId) {
      formData.append("existingFiles", JSON.stringify(filesToKeep));
    }

    try {
      if (editId) {
        await axios.put(`${API_URL}/${editId}`, formData);
        toast.success("Employee updated successfully");
      } else {
        await axios.post(API_URL, formData);
        toast.success("Employee created successfully");
      }

      resetForm();
      fetchEmployees();
      fetchOCRState();
    } catch (error) {
      fetchOCRState();
      const responseData = error.response?.data;
      console.log(error);
      if (
        responseData?.duplicate === true &&
        Array.isArray(responseData?.duplicates)
      ) {
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? "animate-enter" : "animate-leave"
              } max-w-md w-full bg-red-50 border border-red-300 rounded-lg p-4 shadow-lg`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-red-700 font-semibold">
                  {responseData.duplicateCount} Duplicate Bill(s) Detected
                </h3>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="text-red-600 font-bold text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="text-sm text-red-800 space-y-3 max-h-64 overflow-y-auto whitespace-pre-line">
                {responseData.duplicates.map((bill, index) => (
                  <div key={index} className="border-b border-red-200 pb-2">
                    <div>
                      <strong>{index + 1}. Bill No:</strong> {bill.billNumber}
                    </div>

                    <div>Amount: ₹{bill.amount}</div>

                    {/* 🔴 Duplicate within SAME PDF */}
                    {bill.type === "same_upload" ? (
                      <div className="text-red-600">
                        ⚠️ {bill.message} (Page {bill.page})
                      </div>
                    ) : (
                      /* 🔴 Duplicate already in SYSTEM */
                      <>
                        <div>Uploaded by: {bill.uploadedBy}</div>
                        <div>
                          Uploaded on:{" "}
                          {bill.uploadedAt
                            ? format(new Date(bill.uploadedAt), "dd MMM yyyy")
                            : "N/A"}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ),
          {
            duration: Infinity, // 🔥 stays until user closes
          }
        );

        return;
      }

      toast.error(responseData?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
      fetchOCRState();
    }
  };

  const handleEdit = (emp) => {
    setEditId(emp._id);
    setForm({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
    });
    setSelectedFiles([]);
    const files = emp.files || [];
    setExistingFiles(files);
    setFilesToKeep(files);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this employee?")) return;

    setIsDeleting(true);

    try {
      await axios.delete(`${API_URL}/${id}`);
      toast.success("Employee deleted successfully");
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ name: "", email: "", phone: "" });
    setSelectedFiles([]);
    setExistingFiles([]);
    setFilesToKeep([]);
  };

  const handleExtractText = async (fileUrl, isPdf) => {
    setIsExtracting(true);
    setExtractedText("");

    try {
      const response = await axios.post(
        `${API_URL}/extract-text`,
        {
          fileUrl,
          fileType: isPdf ? "pdf" : "image",
        },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        }
      );

      /* ================= IMAGE RESPONSE ================= */
      if (!isPdf && response.data.extractedData) {
        const { bill_number, total_amount } = response.data.extractedData;

        let displayText = "📄 BILL INFORMATION\n";
        displayText += "═".repeat(40) + "\n\n";
        displayText += `🔢 Bill Number: ${bill_number ?? "Not detected"}\n`;
        displayText += `💰 Total Amount: ${total_amount ?? "Not detected"}\n`;
        displayText += "\n" + "═".repeat(40);

        setExtractedText(displayText);
        console.log(extractedText);
        return;
      }

      /* ================= PDF RESPONSE ================= */
      if (isPdf && response.data.bills?.length) {
        let displayText = "📄 MULTIPLE BILLS DETECTED\n";
        displayText += "═".repeat(40) + "\n\n";

        response.data.bills.forEach((bill, index) => {
          displayText += `🧾 Bill ${index + 1} (Page ${bill.page})\n`;
          displayText += `🔢 Bill Number: ${bill.billNo ?? "Not detected"}\n`;
          displayText += `💰 Amount: ${bill.amount ?? "Not detected"}\n`;
          displayText += `📊 Confidence: ${bill.confidence}\n`;
          displayText += "─".repeat(40) + "\n";
        });

        setExtractedText(displayText);
        return;
      }

      /* ================= FALLBACK ================= */
      setExtractedText(
        "⚠️ No data could be extracted.\n\n" +
          "The file was processed, but no bill data was detected."
      );
    } catch (error) {
      console.error("❌ Error extracting text:", error);

      let errorMessage = "❌ Error: Unable to extract text.\n\n";

      if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.message) {
        errorMessage += error.message;
      }

      setExtractedText(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  };

  const renderFilePreview = (file, index, isExisting = false) => {
    const fileUrl = isExisting ? file.url : URL.createObjectURL(file);
    const fileName = isExisting ? file.url.split("/").pop() : file.name;
    const isImage = isExisting
      ? !file.url.toLowerCase().includes(".pdf")
      : file.type.startsWith("image/");

    return (
      <div
        key={index}
        className="group relative border-2 border-gray-200 rounded-xl overflow-hidden bg-white hover:border-blue-400 transition-all"
      >
        <button
          type="button"
          onClick={() =>
            isExisting
              ? handleRemoveExistingFile(index)
              : handleRemoveFile(index)
          }
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 transition-all z-10 opacity-0 group-hover:opacity-100"
          title="Remove file"
        >
          <X className="w-4 h-4" />
        </button>

        {isImage ? (
          <img
            src={fileUrl}
            className="h-28 w-full object-cover"
            alt={fileName}
          />
        ) : (
          <div className="h-28 flex items-center justify-center bg-red-50">
            <FileText className="w-12 h-12 text-red-500" />
          </div>
        )}
        <div className="p-2 bg-gray-50">
          <p className="text-xs text-gray-600 truncate">
            {fileName.substring(0, 20)}
          </p>
        </div>
      </div>
    );
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.phone.includes(searchTerm)
  );

  const ocrBlocked = ocrQuota?.exhausted && !paidOcrEnabled;

  useEffect(() => {
    fetchEmployees();
    fetchOCRState();
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl font-bold text-center bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Bill Management
          </h1>

          <p className="text-center text-gray-600">
            Manage your team with ease
          </p>

          {/* OCR TOGGLE */}
          {ocrQuota?.exhausted && (
            <div className="flex justify-center mt-4">
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow border border-red-200">
                <span className="text-sm font-semibold text-gray-700">
                  OCR Paid Mode
                  {/* STEP-3: Show paid OCR toggle ONLY when free tier is exhausted */}
                </span>

                <button
                  type="button"
                  onClick={handlePaidOcrToggle}
                  disabled={ocrToggleLoading}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all
                              ${paidOcrEnabled ? "bg-green-500" : "bg-gray-300"}
                              ${
                                ocrToggleLoading
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }
                                `}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all
                                  ${
                                    paidOcrEnabled
                                      ? "translate-x-8"
                                      : "translate-x-1"
                                  }
    `}
                  />
                </button>

                {ocrBlocked && (
                  <p className="text-xs text-gray-500 mt-1">
                    Free tier resets on {ocrQuota.resetAt}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= OCR USAGE STATUS ================= */}
      {ocrQuota && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
            {/* Left */}
            <div>
              {}
              <p className="text-sm text-gray-500">
                OCR Usage{" "}
                {`${new Date(`${ocrQuota.month}-01`).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    year: "numeric",
                  }
                )}`}
              </p>
              <p className="text-lg font-semibold text-gray-800">
                {paidOcrEnabled
                  ? ocrQuota.used
                  : `${ocrQuota.used} / ${ocrQuota.limit}`}{" "}
                scans
              </p>

              {!paidOcrEnabled && ocrQuota.remaining === 0 && (
                <p className="text-sm text-red-600 mt-1">
                  Free OCR limit exhausted. Enable paid OCR to continue.
                </p>
              )}
            </div>

            {/* Right */}
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {paidOcrEnabled ? "Paid OCR Cost" : "OCR Cost"}
              </p>

              <p className="text-xl font-bold text-indigo-600">
                ₹{paidOcrEnabled ? ocrCost : 0}
              </p>

              {!paidOcrEnabled && (
                <p className="text-xs text-gray-500 mt-1">Free tier</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewFile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setViewFile(null);
            setExtractedText("");
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-6xl max-h-[90vh] w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 text-white p-5 flex justify-between items-center">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-6 h-6" />
                File Viewer
              </h3>
              <div className="flex items-center gap-3">
                {!viewFile?.file?.extractedBills?.length && (
                  <button
                    onClick={async () => {
                      // If OCR is blocked, enable paid OCR first
                      if (ocrBlocked) {
                        const enabled = await handlePaidOcrToggle();
                        if (!enabled) return; // stop if toggle failed
                      }

                      // Now OCR is allowed → extract & upload
                      setExtractedText("");
                      handleExtractText(viewFile.url, viewFile.isPdf);
                    }}
                    disabled={isExtracting}
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {ocrBlocked ? (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        Enable Paid OCR
                      </>
                    ) : isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Extract Text
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    setViewFile(null);
                    setExtractedText("");
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(90vh-100px)]">
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                <div className="space-y-4">
                  {viewFile.isPdf ? (
                    <div className="space-y-4">
                      <object
                        data={viewFile.url}
                        type="application/pdf"
                        className="w-full h-[60vh] border-2 border-gray-200 rounded-xl"
                      >
                        <div className="flex flex-col items-center justify-center h-[60vh] bg-gray-50 rounded-xl">
                          <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
                          <p className="text-gray-600 mb-4">
                            PDF cannot be displayed in browser
                          </p>
                          <a
                            href={viewFile.url}
                            download
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download PDF
                          </a>
                        </div>
                      </object>
                      <div className="flex gap-3">
                        <a
                          href={viewFile.url}
                          download
                          className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                        <a
                          href={viewFile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                        <img
                          src={viewFile.url}
                          alt="File preview"
                          className="w-full h-[60vh] object-contain bg-gray-50"
                        />
                      </div>
                      <div className="flex gap-3">
                        <a
                          href={viewFile.url}
                          download
                          className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                        <a
                          href={viewFile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 sticky top-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
              {editId ? (
                <>
                  <Edit2 className="w-6 h-6 text-blue-600" />
                  Edit Employee
                </>
              ) : (
                <>
                  <Plus className="w-6 h-6 text-green-600" />
                  Add Employee
                </>
              )}
            </h2>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Name
                </label>
                <input
                  name="name"
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </label>
                <input
                  name="phone"
                  placeholder="10 digit phone"
                  value={form.phone}
                  onChange={handleChange}
                  maxLength="10"
                  className="w-full border-2 border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Files {!editId && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="w-full border-2 border-dashed border-gray-300 p-4 rounded-xl hover:border-blue-500 transition-all cursor-pointer flex items-center justify-center gap-2 bg-gray-50 hover:bg-blue-50"
                  >
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-600">Choose files</span>
                  </label>
                </div>
              </div>

              {existingFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Existing Files ({existingFiles.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {existingFiles.map((file, index) =>
                      renderFilePreview(file, index, true)
                    )}
                  </div>
                </div>
              )}

              {selectedFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {editId ? "New Files" : "Selected Files"} (
                    {selectedFiles.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedFiles.map((file, index) =>
                      renderFilePreview(file, index, false)
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : editId ? (
                    "Update Employee"
                  ) : (
                    "Add Employee"
                  )}
                </button>

                {editId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-400 text-white py-3 px-4 rounded-xl hover:bg-gray-500 transition-all font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Employees List
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-linear-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Phone
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Files
                    </th>
                    <th className="p-4 text-center font-semibold text-gray-700">
                      Bill Data
                    </th>
                    <th className="p-4 text-center font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr
                      key={emp._id}
                      className="border-t border-gray-100 hover:bg-blue-50 transition-all"
                    >
                      <td className="p-4 font-medium text-gray-800">
                        {emp.name}
                      </td>
                      <td className="p-4 text-gray-600">{emp.email}</td>
                      <td className="p-4 text-gray-600">{emp.phone}</td>
                      <td className="p-4">
                        {emp.files?.length ? (
                          <div className="flex gap-2 flex-wrap">
                            {emp.files.map((file, i) => {
                              const isPdf =
                                typeof file?.filename === "string" &&
                                file.filename.toLowerCase().endsWith(".pdf");

                              return (
                                <button
                                  key={i}
                                  onClick={() =>
                                    setViewFile({
                                      file,
                                      url: file.url,
                                      isPdf,
                                    })
                                  }
                                  className="group relative hover:scale-110 transition-transform"
                                  title={`View file ${i + 1}`}
                                >
                                  {isPdf ? (
                                    <div className="w-12 h-12 bg-red-100 border-2 border-red-300 rounded-lg flex flex-col items-center justify-center hover:border-red-500 transition-all shadow-sm">
                                      <FileText className="w-6 h-6 text-red-600" />
                                    </div>
                                  ) : (
                                    <img
                                      src={file.url}
                                      alt={`File ${i + 1}`}
                                      className="w-12 h-12 object-cover rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-all shadow-sm"
                                    />
                                  )}
                                  <span className="absolute -bottom-1 -right-1 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold shadow-lg">
                                    {i + 1}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No files</span>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        {emp.files?.some((f) => f.extractedBills?.length) ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {emp.files.map((file, fIndex) =>
                              file.extractedBills?.map((bill, bIndex) => (
                                <div
                                  key={`${fIndex}-${bIndex}`}
                                  className="border border-green-200 bg-green-50 rounded-lg p-2 text-sm"
                                >
                                  <p className="font-medium text-gray-800">
                                    Bill {bIndex + 1}
                                    {bill.page && (
                                      <span className="text-xs text-gray-500">
                                        {" "}
                                        • Page {bill.page}
                                      </span>
                                    )}
                                  </p>

                                  <p>
                                    <span className="font-semibold">No:</span>{" "}
                                    {bill.billNo ?? "—"}
                                  </p>

                                  <p>
                                    <span className="font-semibold">
                                      Amount:
                                    </span>{" "}
                                    ₹{bill.amount ?? "—"}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-sm">
                            No extracted data
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(emp)}
                            className="text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-all group"
                            title="Edit"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp._id)}
                            disabled={isDeleting}
                            className="text-red-600 hover:bg-red-100 p-2 rounded-lg transition-all group disabled:opacity-50"
                            title="Delete"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-12">
                        <div className="flex flex-col items-center">
                          <User className="w-16 h-16 text-gray-300 mb-4" />
                          <p className="text-gray-400 text-lg">
                            {searchTerm
                              ? "No employees found matching your search"
                              : "No employees yet. Add your first employee!"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeePage;
