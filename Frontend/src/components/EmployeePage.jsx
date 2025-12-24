import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL;
const API_URL = `${API_BASE}/api/employees`;

const EmployeePage = () => {
  const [employees, setEmployees] = useState([]);
  const [editId, setEditId] = useState(null);
  const [previews, setPreviews] = useState([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    files: [],
  });

  /* ---------------- FETCH ---------------- */
  const fetchEmployees = async () => {
    const res = await axios.get(API_URL);
    setEmployees(res.data.data || res.data);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    if (!form.name.trim()) return false;
    if (!form.email.trim()) return false;
    if (!form.phone.trim()) return false;
    if (!form.files || form.files.length === 0) return false;
    return true;
  };

  /* ---------------- INPUT HANDLERS ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    setForm((prev) => ({
      ...prev,
      files,
    }));

    const previewData = files.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name,
    }));

    setPreviews(previewData);
  };

  /* ---------------- CLEANUP OBJECT URLS ---------------- */
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = new FormData();
    data.append("name", form.name);
    data.append("email", form.email);
    data.append("phone", form.phone);

    form.files.forEach((file) => data.append("files", file));

    if (editId) {
      await axios.put(`${API_URL}/${editId}`, data);
    } else {
      await axios.post(API_URL, data);
    }

    resetForm();
    fetchEmployees();
  };

  /* ---------------- EDIT ---------------- */
  const handleEdit = (emp) => {
    setEditId(emp._id);
    setForm({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      files: [],
    });

    if (emp.files?.length) {
      setPreviews(
        emp.files.map((file) => ({
          url: file.url,
          type: file.url.endsWith(".pdf") ? "application/pdf" : "image/*",
          name: file.url.split("/").pop(),
        }))
      );
    } else {
      setPreviews([]);
    }
  };

  /* ---------------- DELETE ---------------- */
  const handleDelete = async (id) => {
    if (!confirm("Delete this employee?")) return;
    await axios.delete(`${API_URL}/${id}`);
    fetchEmployees();
  };

  /* ---------------- RESET ---------------- */
  const resetForm = () => {
    setEditId(null);
    setForm({ name: "", email: "", phone: "", files: [] });
    setPreviews([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">
        Employee Management
      </h1>

      {/* ---------------- FORM ---------------- */}
      <div className="max-w-md mx-auto bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">
          {editId ? "Edit Employee" : "Add Employee"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            name="name"
            placeholder="Name"
            value={form.name}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />

          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />

          <input
            name="phone"
            placeholder="Phone"
            value={form.phone}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />

          <input
            type="file"
            name="files" // ✅ REQUIRED
            multiple
            onChange={handleFileChange}
            className="w-full"
          />

          {/* PREVIEWS */}
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {previews.map((file, index) => (
                <div key={index} className="border p-2 rounded text-center">
                  {file.type.startsWith("image/") ? (
                    <img src={file.url} className="h-24 mx-auto" />
                  ) : (
                    <a
                      href={file.url}
                      target="_blank"
                      className="text-blue-600 underline"
                    >
                      {file.name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button className="flex-1 bg-blue-600 text-white py-2 rounded">
              {editId ? "Update" : "Add"}
            </button>

            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-400 text-white py-2 rounded"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ---------------- LIST ---------------- */}
      <div className="max-w-4xl mx-auto bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Employees</h2>

        <table className="w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2">Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Files</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp._id} className="border-t">
                <td className="p-2">{emp.name}</td>
                <td>{emp.email}</td>
                <td>{emp.phone}</td>
                <td>
                  {emp.files?.length ? (
                    emp.files.map((file, i) => (
                      <a
                        key={i}
                        href={file.url}
                        target="_blank"
                        className="block text-blue-600 underline"
                      >
                        File {i + 1}
                      </a>
                    ))
                  ) : (
                    <span className="text-gray-400">No files</span>
                  )}
                </td>

                <td className="space-x-2">
                  <button
                    onClick={() => handleEdit(emp)}
                    className="text-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(emp._id)}
                    className="text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {!employees.length && (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-400">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeePage;
