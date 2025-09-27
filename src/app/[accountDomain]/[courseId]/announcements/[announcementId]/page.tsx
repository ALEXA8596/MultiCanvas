"use client";
import React, { useEffect, useState } from "react";
import {
  fetchAnnouncements,
  fetchDiscussionTopics,
  Account,
} from "../../../../../components/canvasApi";
import { useParams } from "next/navigation";

type Announcement = {
  id: string;
  title: string;
};

type DiscussionTopic = {
  id: number;
  title: string;
};

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [discussionTopics, setDiscussionTopics] = useState<DiscussionTopic[]>(
    []
  );
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const accountDomain = (params?.accountDomain as string) || "";
  const courseIdParam = params?.courseId as string;
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : NaN;

  useEffect(() => {
    if (!accountDomain || isNaN(courseId)) return;
    const cancelled = false;

    // load account from localStorage
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find((a) => a.domain === accountDomain);
        if (found) setAccount(found);
        else setError("Account not found");
      } else {
        setError("No accounts in localStorage");
      }
    } catch {
      setError("Failed to parse accounts");
    }
  }, [accountDomain, courseId]);

  useEffect(() => {
    if (!account || isNaN(courseId)) return;
    const loadData = async () => {
      const announcementsData = await fetchAnnouncements(
        account,
        courseId
      );
      const discussionTopicsData = await fetchDiscussionTopics(
        account,
        courseId
      );
      setAnnouncements(announcementsData);
      setDiscussionTopics(discussionTopicsData);
    };
    loadData();
  }, [account, courseId]);

  return (
    <div>
      <h1>Announcements</h1>
      <ul>
        {announcements.map((announcement) => (
          <li key={announcement.id}>{announcement.title}</li>
        ))}
      </ul>
      <h2>Discussion Topics</h2>
      <ul>
        {discussionTopics.map((topic) => (
          <li key={topic.id}>{topic.title}</li>
        ))}
      </ul>
    </div>
  );
};

export default AnnouncementsPage;
