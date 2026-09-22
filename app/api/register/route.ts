import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: "Server environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceKey
    );

    const body = await request.json();

    const {
      firstName,
      lastName,
      dateOfBirth,
      grade,
      isReturning,
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      arabicLevel,
      healthInformation,
    } = body;

    if (
      !firstName ||
      !lastName ||
      !dateOfBirth ||
      !grade ||
      !parentFirstName ||
      !parentLastName ||
      !parentEmail
    ) {
      return NextResponse.json(
        {
          error: "Please fill out all required fields.",
        },
        { status: 400 }
      );
    }

    // Create student
    const { data: student, error: studentError } =
      await supabase
        .from("students")
        .insert({
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirth,
          grade,
          arabic_level: arabicLevel || null,
          health_information: healthInformation || null,
        })
        .select()
        .single();

    if (studentError) {
      console.error("STUDENT ERROR:", studentError);

      return NextResponse.json(
        {
          error: `Student: ${studentError.message}`,
        },
        { status: 500 }
      );
    }

    // Create parent
    const { data: parent, error: parentError } =
      await supabase
        .from("parents")
        .insert({
          first_name: parentFirstName,
          last_name: parentLastName,
          email: parentEmail,
          phone: parentPhone || null,
        })
        .select()
        .single();

    if (parentError) {
      console.error("PARENT ERROR:", parentError);

      return NextResponse.json(
        {
          error: `Parent: ${parentError.message}`,
        },
        { status: 500 }
      );
    }

    // Connect student and parent
    const { error: relationshipError } =
      await supabase
        .from("student_parents")
        .insert({
          student_id: student.id,
          parent_id: parent.id,
          relationship: "parent",
        });

    if (relationshipError) {
      console.error(
        "RELATIONSHIP ERROR:",
        relationshipError
      );

      return NextResponse.json(
        {
          error: `Relationship: ${relationshipError.message}`,
        },
        { status: 500 }
      );
    }

    // Create registration
    const { data: registration, error: registrationError } =
      await supabase
        .from("registrations")
        .insert({
          student_id: student.id,
          school_year: "2026-2027",
          status: "pending",
          is_returning: isReturning,
        })
        .select()
        .single();

    if (registrationError) {
      console.error(
        "REGISTRATION ERROR:",
        registrationError
      );

      return NextResponse.json(
        {
          error: `Registration: ${registrationError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      registrationId: registration.id,
    });
  } catch (error) {
    console.error("API ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}