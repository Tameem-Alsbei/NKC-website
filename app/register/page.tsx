"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    // Student
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    grade: "",
    isReturning: false,

    // Parent
    parentFirstName: "",
    parentLastName: "",
    parentEmail: "",
    parentPhone: "",

    // Additional
    arabicLevel: "",
    studiedArabicBefore: "",
    healthInformation: "",
  });

  function updateField(field: string, value: string | boolean) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit() {
  setSubmitting(true);
  setError("");
  setSuccess("");

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Registration failed.");
    }

    setSuccess("Registration submitted successfully!");
    setStep(5);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong."
    );
  } finally {
    setSubmitting(false);
  }
}

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">

        <h1 className="text-3xl font-bold">
          Saturday Arabic School Registration
        </h1>

        <p className="mt-2 text-gray-600">
          Step {step} of 4
        </p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-lg bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="mt-8 space-y-5 rounded-xl bg-white p-6 shadow">

            <h2 className="text-xl font-semibold">
              Student Information
            </h2>

            <input
              placeholder="First name"
              value={formData.firstName}
              onChange={(e) =>
                updateField("firstName", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

            <input
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) =>
                updateField("lastName", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

            <div>
              <label className="mb-2 block text-sm font-medium">
                Date of birth
              </label>

              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) =>
                  updateField("dateOfBirth", e.target.value)
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <select
              value={formData.grade}
              onChange={(e) =>
                updateField("grade", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="">Select grade</option>
              <option value="Pre-K">Pre-K</option>
              <option value="K">Kindergarten</option>
              <option value="1">1st Grade</option>
              <option value="2">2nd Grade</option>
              <option value="3">3rd Grade</option>
              <option value="4">4th Grade</option>
              <option value="5">5th Grade</option>
              <option value="6">6th Grade</option>
              <option value="7">7th Grade</option>
              <option value="8">8th Grade</option>
              <option value="9">9th Grade</option>
              <option value="10">10th Grade</option>
              <option value="11">11th Grade</option>
              <option value="12">12th Grade</option>
            </select>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.isReturning}
                onChange={(e) =>
                  updateField("isReturning", e.target.checked)
                }
              />

              Returning student
            </label>

            <button
              onClick={() => setStep(2)}
              className="w-full rounded-lg bg-black p-3 text-white"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="mt-8 space-y-5 rounded-xl bg-white p-6 shadow">

            <h2 className="text-xl font-semibold">
              Parent Information
            </h2>

            <input
              placeholder="Parent first name"
              value={formData.parentFirstName}
              onChange={(e) =>
                updateField("parentFirstName", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

            <input
              placeholder="Parent last name"
              value={formData.parentLastName}
              onChange={(e) =>
                updateField("parentLastName", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

            <input
              type="email"
              placeholder="Parent email"
              value={formData.parentEmail}
              onChange={(e) =>
                updateField("parentEmail", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

            <input
              type="tel"
              placeholder="Phone number"
              value={formData.parentPhone}
              onChange={(e) =>
                updateField("parentPhone", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border p-3"
              >
                Back
              </button>

              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-black p-3 text-white"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="mt-8 space-y-5 rounded-xl bg-white p-6 shadow">

            <h2 className="text-xl font-semibold">
              Arabic & Health Information
            </h2>

            <select
              value={formData.arabicLevel}
              onChange={(e) =>
                updateField("arabicLevel", e.target.value)
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="">Arabic level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <div>
              <p className="mb-3 font-medium">
                Has the student studied Arabic before?
              </p>

              <label className="mr-6">
                <input
                  type="radio"
                  name="studiedArabic"
                  value="yes"
                  checked={formData.studiedArabicBefore === "yes"}
                  onChange={(e) =>
                    updateField(
                      "studiedArabicBefore",
                      e.target.value
                    )
                  }
                />{" "}
                Yes
              </label>

              <label>
                <input
                  type="radio"
                  name="studiedArabic"
                  value="no"
                  checked={formData.studiedArabicBefore === "no"}
                  onChange={(e) =>
                    updateField(
                      "studiedArabicBefore",
                      e.target.value
                    )
                  }
                />{" "}
                No
              </label>
            </div>

            <textarea
              placeholder="Health information or special considerations"
              value={formData.healthInformation}
              onChange={(e) =>
                updateField(
                  "healthInformation",
                  e.target.value
                )
              }
              className="min-h-32 w-full rounded-lg border p-3"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg border p-3"
              >
                Back
              </button>

              <button
                onClick={() => setStep(4)}
                className="flex-1 rounded-lg bg-black p-3 text-white"
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="mt-8 rounded-xl bg-white p-6 shadow">

            <h2 className="text-xl font-semibold">
              Review Registration
            </h2>

            <div className="mt-6 space-y-3">
              <p>
                <strong>Student:</strong>{" "}
                {formData.firstName} {formData.lastName}
              </p>

              <p>
                <strong>Date of birth:</strong>{" "}
                {formData.dateOfBirth}
              </p>

              <p>
                <strong>Grade:</strong>{" "}
                {formData.grade}
              </p>

              <p>
                <strong>Parent:</strong>{" "}
                {formData.parentFirstName}{" "}
                {formData.parentLastName}
              </p>

              <p>
                <strong>Email:</strong>{" "}
                {formData.parentEmail}
              </p>

              <p>
                <strong>Phone:</strong>{" "}
                {formData.parentPhone}
              </p>

              <p>
                <strong>Arabic level:</strong>{" "}
                {formData.arabicLevel}
              </p>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg border p-3"
              >
                Back
              </button>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-black p-3 text-white disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Registration"}
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {step === 5 && (
          <div className="mt-8 rounded-xl bg-white p-8 text-center shadow">
            <h2 className="text-2xl font-bold">
              Registration Complete
            </h2>

            <p className="mt-3 text-gray-600">
              The student registration has been submitted.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}