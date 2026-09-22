"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type Student = {
  id: number;
  first_name: string;
  last_name: string;
  grade: string;
};

export default function TestDatabasePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function getStudents() {
    const { data, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, grade");

    if (error) {
      setError(error.message);
      return;
    }

    setStudents(data || []);
  }

  async function addTestStudent() {
    setError("");
    setMessage("");

    const { error } = await supabase
      .from("students")
      .insert({
        first_name: "Website",
        last_name: "Test",
        date_of_birth: "2016-05-20",
        grade: "4",
        arabic_level: "beginner",
      });

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Student added successfully!");
    getStudents();
  }

  useEffect(() => {
    getStudents();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">
          Database Test
        </h1>

        <button
          onClick={addTestStudent}
          className="mt-6 rounded-lg bg-black px-5 py-3 text-white hover:bg-gray-800"
        >
          Add Test Student
        </button>

        {message && (
          <p className="mt-4 text-green-600">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-4 text-red-600">
            Error: {error}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {students.map((student) => (
            <div
              key={student.id}
              className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
            >
              <p className="font-semibold">
                {student.first_name} {student.last_name}
              </p>

              <p className="text-sm text-gray-500">
                Grade {student.grade}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}