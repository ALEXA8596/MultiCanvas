"use client";
import { useEffect, useState } from "react";
import { Account } from "../../components/canvasApi";
import {
  CourseSetting,
  getCourseSettings,
  setCourseSetting,
} from "../../lib/db";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import { TextInput } from "@instructure/ui-text-input";
import { Checkbox } from "@instructure/ui-checkbox";
import { Table } from "@instructure/ui-table";
import { NumberInput } from "@instructure/ui-number-input";

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [courseSettings, setCourseSettings] = useState<CourseSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedAccounts = localStorage.getItem("accounts");
    if (savedAccounts) {
      setAccounts(JSON.parse(savedAccounts));
    }

    async function loadData() {
      setLoading(true);
      const settings = await getCourseSettings();
      setCourseSettings(settings);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleCourseSettingChange = async (
    id: string,
    field: keyof CourseSetting,
    value: any
  ) => {
    const existing =
      courseSettings.find((s) => s.id === id) || ({ id } as CourseSetting);
    const updated = { ...existing, [field]: value };
    await setCourseSetting(updated);
    const newSettings = await getCourseSettings();
    setCourseSettings(newSettings);
  };

  if (loading) {
    return <Text>Loading settings...</Text>;
  }

  return (
    <div className="settings-container fade-in">
      <Heading level="h2" margin="0 0 medium 0" className="text-gradient">
        Settings
      </Heading>

      <View as="section" margin="0 0 large 0">
        <Heading level="h3" margin="0 0 medium 0">Course Display Settings</Heading>
        <Table caption="Course Display Settings">
          <Table.Head>
            <Table.Row>
              <Table.ColHeader id="course-id">Course ID</Table.ColHeader>
              <Table.ColHeader id="nickname">Nickname</Table.ColHeader>
              <Table.ColHeader id="order">Order</Table.ColHeader>
              <Table.ColHeader id="visible">Visible</Table.ColHeader>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {courseSettings.map((setting) => (
              <Table.Row key={setting.id}>
                <Table.Cell>{setting.id}</Table.Cell>
                <Table.Cell>
                  <TextInput
                    renderLabel=""
                    value={setting.nickname || ""}
                    onChange={(_, value) =>
                      handleCourseSettingChange(setting.id, "nickname", value)
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <NumberInput
                    renderLabel=""
                    value={setting.order || 0}
                    onChange={(_, value) =>
                      handleCourseSettingChange(setting.id, "order", Number(value))
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <Checkbox
                    label="Visible"
                    checked={setting.visible !== false}
                    onChange={() =>
                      handleCourseSettingChange(setting.id, "visible", ! (setting.visible !== false))
                    }
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </View>
    </div>
  );
}
