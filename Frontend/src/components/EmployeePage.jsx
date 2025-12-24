import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL;
const API_URL = `${API_BASE}/api/employees`;

const EmployeePage = () => {
  const [employees, setEmployees] = useState([]);
  const [editId, setEditId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [filesToKeep, setFilesToKeep] = useState([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [viewFile, setViewFile] = useState(null);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(API_URL);
      setEmployees(res.data.data || res.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const validate = () => {
    if (!form.name.trim()) {
      alert("Name is required");
      return false;
    }
    if (!form.email.trim()) {
      alert("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      alert("Invalid email format");
      return false;
    }
    if (!form.phone.trim()) {
      alert("Phone is required");
      return false;
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      alert("Phone must be 10 digits");
      return false;
    }
    if (!editId && selectedFiles.length === 0) {
      alert("At least one file is required");
      return false;
    }
    if (editId && filesToKeep.length === 0 && selectedFiles.length === 0) {
      alert("At least one file is required");
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
    e.target.value = ""; // Reset input
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingFile = (index) => {
    setExistingFiles((prev) => prev.filter((_, i) => i !== index));
    setFilesToKeep((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = new FormData();
    data.append("name", form.name);
    data.append("email", form.email);
    data.append("phone", form.phone);

    selectedFiles.forEach((file) => {
      data.append("files", file);
    });

    if (editId) {
      data.append("existingFiles", JSON.stringify(filesToKeep));
    }

    try {
      if (editId) {
        await axios.put(`${API_URL}/${editId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Employee updated successfully");
      } else {
        await axios.post(API_URL, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Employee created successfully");
      }

      resetForm();
      fetchEmployees();
    } catch (error) {
      console.error("Error submitting form:", error);
      alert(error.response?.data?.message || "An error occurred");
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
    setExistingFiles(emp.files || []);
    setFilesToKeep(emp.files || []);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this employee?")) return;
    
    try {
      await axios.delete(`${API_URL}/${id}`);
      alert("Employee deleted successfully");
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert(error.response?.data?.message || "An error occurred");
    }
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ name: "", email: "", phone: "" });
    setSelectedFiles([]);
    setExistingFiles([]);
    setFilesToKeep([]);
  };

  const renderFilePreview = (file, index, isExisting = false) => {
    const fileUrl = isExisting ? file.url : URL.createObjectURL(file);
    const fileName = isExisting ? file.url.split("/").pop() : file.name;
    const isImage = isExisting 
      ? !file.url.toLowerCase().includes('.pdf')
      : file.type.startsWith("image/");

    return (
      <div key={index} className="border p-2 rounded relative bg-gray-50">
        <button
          type="button"
          onClick={() => isExisting ? handleRemoveExistingFile(index) : handleRemoveFile(index)}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-lg font-bold shadow z-10"
          title="Remove file"
        >
          ×
        </button>
        
        {isImage ? (
          <img 
            src={fileUrl} 
            className="h-24 w-full object-cover rounded" 
            alt={fileName}
          />
        ) : (
          <div className="h-24 flex items-center justify-center bg-gray-100 rounded">
            <div className="text-center p-2">
              <svg className="w-8 h-8 mx-auto text-red-600 mb-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-gray-600 break-all">PDF</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
        Employee Management
      </h1>

      {viewFile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setViewFile(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">File Viewer</h3>
              <button
                onClick={() => setViewFile(null)}
                className="text-white hover:text-gray-300 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {viewFile.isPdf ? (
                <div className="space-y-4">
                  <object
                    data={viewFile.url}
                    type="application/pdf"
                    className="w-full h-[70vh] border rounded"
                  >
                    <div className="flex flex-col items-center justify-center h-[70vh] bg-gray-100 rounded">
                      <svg className="w-16 h-16 text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <p className="text-gray-600 mb-4">PDF cannot be displayed in browser</p>
                      <a
                        href={viewFile.url}
                        download
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                      >
                        Download PDF
                      </a>
                    </div>
                  </object>
                  <div className="flex gap-2 justify-center">
                    <a
                      href={viewFile.url}
                      download
                      className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                    >
                      Download PDF
                    </a>
                    <a
                      href={viewFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
                    >
                      Open in New Tab
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <img
                    src={viewFile.url}
                    alt="File preview"
                    className="max-w-full max-h-[70vh] object-contain rounded"
                  />
                  <div className="mt-4 flex gap-2">
                    <a
                      href={viewFile.url}
                      download
                      className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                    >
                      Download Image
                    </a>
                    <a
                      href={viewFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
                    >
                      Open in New Tab
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          {editId ? "Edit Employee" : "Add Employee"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              name="name"
              placeholder="Enter full name"
              value={form.name}
              onChange={handleChange}
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              placeholder="email@example.com"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              name="phone"
              placeholder="10 digit phone number"
              value={form.phone}
              onChange={handleChange}
              maxLength="10"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Files {!editId && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {existingFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Existing Files ({existingFiles.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {existingFiles.map((file, index) => 
                  renderFilePreview(file, index, true)
                )}
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {editId ? "New Files to Add" : "Selected Files"} ({selectedFiles.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {selectedFiles.map((file, index) => 
                  renderFilePreview(file, index, false)
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition font-medium"
            >
              {editId ? "Update Employee" : "Add Employee"}
            </button>

            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-400 text-white py-2 px-4 rounded hover:bg-gray-500 transition font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="text-xl font-semibold text-gray-700">Employees List</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Email</th>
                <th className="p-3 text-left font-semibold">Phone</th>
                <th className="p-3 text-left font-semibold">Files</th>
                <th className="p-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp._id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{emp.name}</td>
                  <td className="p-3">{emp.email}</td>
                  <td className="p-3">{emp.phone}</td>
                  <td className="p-3">
                    {emp.files?.length ? (
                      <div className="flex gap-2 flex-wrap">
                        {emp.files.map((file, i) => {
                          const isPdf = file.url.toLowerCase().includes('.pdf');
                          
                          return (
                            <div key={i} className="relative group">
                              {isPdf ? (
                                <button
                                  onClick={() => setViewFile({ url: file.url, isPdf: true })}
                                  className="block"
                                  title="View PDF"
                                >
                                  <div className="w-16 h-16 bg-red-100 border-2 border-red-300 rounded flex flex-col items-center justify-center hover:border-red-500 transition cursor-pointer">
                                    <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs text-red-600 font-semibold mt-1">PDF</span>
                                  </div>
                                  <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {i + 1}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => setViewFile({ url: file.url, isPdf: false })}
                                  className="block"
                                  title={`View image ${i + 1}`}
                                >
                                  <img 
                                    src={file.url} 
                                    alt={`File ${i + 1}`}
                                    className="w-16 h-16 object-cover rounded border-2 border-gray-300 hover:border-blue-500 transition cursor-pointer"
                                  />
                                  <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {i + 1}
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-400">No files</span>
                    )}
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleEdit(emp)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(emp._id)}
                      className="text-red-600 hover:text-red-800 hover:underline font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!employees.length && (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-400">
                    No employees found. Add your first employee above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeePage;