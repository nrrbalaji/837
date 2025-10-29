import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button,
  Checkbox,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Collapse,
  Typography,
  Divider,
} from "@mui/material";
import { Grid } from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";

/**
 * Facility Ingestion Configuration Component
 * Allows configuration of SFTP, Local Folder, or REST API ingestion modes
 */

interface SftpConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password?: string;
  password_encrypted?: string;
  auth_method: "password" | "ssh_key";
  private_key_path?: string;
  input_folder: string;
  output_folder: string;
  archive_folder?: string;
  poll_interval_seconds: number;
  connection_timeout_seconds: number;
  max_retries: number;
}

interface LocalConfig {
  enabled: boolean;
  input_folder: string;
  output_folder: string;
  archive_folder?: string;
  watch_recursive: boolean;
  debounce_milliseconds: number;
}

interface IngestionConfig {
  mode: "REST_API" | "SFTP" | "LOCAL_FOLDER";
  data_format: "FHIR" | "HL7";
  sftp?: SftpConfig;
  local?: LocalConfig;
}

interface Props {
  facilityId?: string;
  initialMode?: "REST_API" | "SFTP" | "LOCAL_FOLDER";
  initialConfig?: IngestionConfig;
  onSave?: (mode: string, config: IngestionConfig) => void;
}

// Validation Schema
const sftpValidationSchema = Yup.object({
  host: Yup.string().required("SFTP host is required"),
  port: Yup.number()
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535")
    .required("Port is required"),
  username: Yup.string().required("Username is required"),
  password: Yup.string().when("auth_method", {
    is: "password",
    then: (schema) =>
      schema
        .min(8, "Password must be at least 8 characters")
        .required("Password is required"),
  }),
  private_key_path: Yup.string().when("auth_method", {
    is: "ssh_key",
    then: (schema) => schema.required("SSH key path is required"),
  }),
  input_folder: Yup.string()
    .matches(/^\//, "Must be an absolute path (start with /)")
    .required("Input folder is required"),
  output_folder: Yup.string()
    .matches(/^\//, "Must be an absolute path (start with /)")
    .required("Output folder is required"),
  archive_folder: Yup.string().matches(
    /^\//,
    "Must be an absolute path (start with /)"
  ),
  poll_interval_seconds: Yup.number().min(60, "Minimum 1 minute (60 seconds)"),
});

const localValidationSchema = Yup.object({
  input_folder: Yup.string().required("Input folder is required"),
  output_folder: Yup.string().required("Output folder is required"),
  debounce_milliseconds: Yup.number()
    .min(500, "Minimum 500ms")
    .max(10000, "Maximum 10000ms"),
});

const FacilityIngestionConfig: React.FC<Props> = ({
  facilityId,
  initialMode = "REST_API",
  initialConfig,
  onSave,
}) => {
  const [ingestionMode, setIngestionMode] = useState<
    "REST_API" | "SFTP" | "LOCAL_FOLDER"
  >(initialMode);
  const [dataFormat, setDataFormat] = useState<"FHIR" | "HL7">(
    initialConfig?.data_format || "FHIR"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // SFTP Form
  const sftpForm = useFormik<SftpConfig>({
    initialValues: {
      enabled: true,
      host: "",
      port: 22,
      username: "",
      password: "",
      auth_method: "password",
      input_folder: "/inbound/837",
      output_folder: "/outbound/837",
      archive_folder: "/archive",
      poll_interval_seconds: 300,
      connection_timeout_seconds: 30,
      max_retries: 3,
      ...initialConfig?.sftp,
    },
    validationSchema: sftpValidationSchema,
    onSubmit: (_values) => {
      handleSave();
    },
  });

  // Local Folder Form
  const localForm = useFormik<LocalConfig>({
    initialValues: {
      enabled: true,
      input_folder: "",
      output_folder: "",
      archive_folder: "",
      watch_recursive: false,
      debounce_milliseconds: 2000,
      ...initialConfig?.local,
    },
    validationSchema: localValidationSchema,
    onSubmit: (_values) => {
      handleSave();
    },
  });

  useEffect(() => {
    // Load existing configuration if facilityId provided
    if (facilityId) {
      loadFacilityConfig();
    }
  }, [facilityId]);

  const loadFacilityConfig = async () => {
    try {
      const response = await axios.get(`/api/v1/facilities/${facilityId}`);
      const facility = response.data;

      if (facility.ingestion_mode) {
        setIngestionMode(facility.ingestion_mode);
      }

      if (facility.ingestion_config) {
        // Set data format from existing config
        if (facility.ingestion_config.data_format) {
          setDataFormat(facility.ingestion_config.data_format);
        }

        if (facility.ingestion_config.sftp) {
          sftpForm.setValues({
            ...sftpForm.values,
            ...facility.ingestion_config.sftp,
            password: "", // Don't populate password from server
          });
        }

        if (facility.ingestion_config.local) {
          localForm.setValues({
            ...localForm.values,
            ...facility.ingestion_config.local,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load facility configuration:", error);
    }
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newMode = event.target.value as "REST_API" | "SFTP" | "LOCAL_FOLDER";
    setIngestionMode(newMode);
    setTestResult(null); // Clear test results when mode changes
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const config: any = {
        ingestion_mode: ingestionMode,
        ingestion_config: {},
      };

      if (ingestionMode === "SFTP") {
        // Validate SFTP fields first
        await sftpForm.validateForm();
        if (Object.keys(sftpForm.errors).length > 0) {
          setTestResult({
            success: false,
            message: "Please fix validation errors before testing connection",
          });
          setTestingConnection(false);
          return;
        }

        config.ingestion_config.sftp = sftpForm.values;
      } else if (ingestionMode === "LOCAL_FOLDER") {
        await localForm.validateForm();
        if (Object.keys(localForm.errors).length > 0) {
          setTestResult({
            success: false,
            message: "Please fix validation errors before testing connection",
          });
          setTestingConnection(false);
          return;
        }

        config.ingestion_config.local = localForm.values;
      }

      const response = await axios.post(
        `/api/v1/ingestion/facility/${facilityId || "test"}/test-connection`,
        config
      );

      setTestResult({
        success: response.data.success,
        message: response.data.message,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || "Connection test failed",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    const config: IngestionConfig = {
      mode: ingestionMode,
      data_format: dataFormat,
    };

    if (ingestionMode === "SFTP") {
      config.sftp = sftpForm.values;
    } else if (ingestionMode === "LOCAL_FOLDER") {
      config.local = localForm.values;
    }

    if (onSave) {
      onSave(ingestionMode, config);
    } else if (facilityId) {
      try {
        await axios.put(`/api/v1/facilities/${facilityId}`, {
          ingestion_mode: ingestionMode,
          ingestion_config: config,
        });
        alert("Configuration saved successfully");
      } catch (error) {
        console.error("Failed to save configuration:", error);
        alert("Failed to save configuration");
      }
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📥 File Ingestion Configuration
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {/* Ingestion Mode Selection */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">Ingestion Mode *</FormLabel>
          <RadioGroup value={ingestionMode} onChange={handleModeChange}>
            <FormControlLabel
              value="REST_API"
              control={<Radio />}
              label="REST API Upload (Default)"
            />
            <FormControlLabel
              value="SFTP"
              control={<Radio />}
              label="SFTP Server"
            />
            <FormControlLabel
              value="LOCAL_FOLDER"
              control={<Radio />}
              label="Local File System"
            />
          </RadioGroup>
        </FormControl>

        {/* Data Format Selection */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">Data Format *</FormLabel>
          <RadioGroup
            value={dataFormat}
            onChange={(event) =>
              setDataFormat(event.target.value as "FHIR" | "HL7")
            }
          >
            <FormControlLabel
              value="FHIR"
              control={<Radio />}
              label="FHIR (Fast Healthcare Interoperability Resources)"
              disabled
            />
            <FormControlLabel
              value="HL7"
              control={<Radio />}
              label="HL7 (Health Level Seven)"
              disabled
            />
          </RadioGroup>
        </FormControl>

        {/* SFTP Configuration */}
        <Collapse in={ingestionMode === "SFTP"}>
          <Box
            sx={{ p: 2, border: "1px solid #e0e0e0", borderRadius: 1, mb: 2 }}
          >
            <Typography variant="subtitle1" gutterBottom>
              SFTP Configuration
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="SFTP Host"
                  name="host"
                  required
                  value={sftpForm.values.host}
                  onChange={sftpForm.handleChange}
                  error={sftpForm.touched.host && Boolean(sftpForm.errors.host)}
                  helperText={sftpForm.touched.host && sftpForm.errors.host}
                  placeholder="ftp.clearinghouse.com"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Port"
                  name="port"
                  type="number"
                  required
                  value={sftpForm.values.port}
                  onChange={sftpForm.handleChange}
                  error={sftpForm.touched.port && Boolean(sftpForm.errors.port)}
                  helperText={sftpForm.touched.port && sftpForm.errors.port}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  required
                  value={sftpForm.values.username}
                  onChange={sftpForm.handleChange}
                  error={
                    sftpForm.touched.username &&
                    Boolean(sftpForm.errors.username)
                  }
                  helperText={
                    sftpForm.touched.username && sftpForm.errors.username
                  }
                  placeholder="facility_001"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">
                    Authentication Method
                  </FormLabel>
                  <RadioGroup
                    name="auth_method"
                    value={sftpForm.values.auth_method}
                    onChange={sftpForm.handleChange}
                    row
                  >
                    <FormControlLabel
                      value="password"
                      control={<Radio />}
                      label="Password"
                    />
                    <FormControlLabel
                      value="ssh_key"
                      control={<Radio />}
                      label="SSH Key"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              {sftpForm.values.auth_method === "password" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={sftpForm.values.password}
                    onChange={sftpForm.handleChange}
                    error={
                      sftpForm.touched.password &&
                      Boolean(sftpForm.errors.password)
                    }
                    helperText={
                      sftpForm.touched.password && sftpForm.errors.password
                    }
                    placeholder="Enter SFTP password"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              )}

              {sftpForm.values.auth_method === "ssh_key" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="SSH Private Key Path"
                    name="private_key_path"
                    required
                    value={sftpForm.values.private_key_path || ""}
                    onChange={sftpForm.handleChange}
                    error={
                      sftpForm.touched.private_key_path &&
                      Boolean(sftpForm.errors.private_key_path)
                    }
                    helperText={
                      sftpForm.touched.private_key_path &&
                      sftpForm.errors.private_key_path
                    }
                    placeholder="/keys/facility_001.pem"
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Input Folder"
                  name="input_folder"
                  required
                  value={sftpForm.values.input_folder}
                  onChange={sftpForm.handleChange}
                  error={
                    sftpForm.touched.input_folder &&
                    Boolean(sftpForm.errors.input_folder)
                  }
                  helperText={
                    (sftpForm.touched.input_folder &&
                      sftpForm.errors.input_folder) ||
                    "Remote folder to poll for input files"
                  }
                  placeholder="/inbound/837"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Output Folder"
                  name="output_folder"
                  required
                  value={sftpForm.values.output_folder}
                  onChange={sftpForm.handleChange}
                  error={
                    sftpForm.touched.output_folder &&
                    Boolean(sftpForm.errors.output_folder)
                  }
                  helperText={
                    (sftpForm.touched.output_folder &&
                      sftpForm.errors.output_folder) ||
                    "Remote folder to upload processed files"
                  }
                  placeholder="/outbound/837"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Archive Folder (Optional)"
                  name="archive_folder"
                  value={sftpForm.values.archive_folder}
                  onChange={sftpForm.handleChange}
                  helperText="Optional folder to archive original files"
                  placeholder="/archive"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Poll Interval (minutes)"
                  name="poll_interval_seconds"
                  type="number"
                  value={sftpForm.values.poll_interval_seconds / 60}
                  onChange={(e) =>
                    sftpForm.setFieldValue(
                      "poll_interval_seconds",
                      parseInt(e.target.value) * 60
                    )
                  }
                  helperText="How often to check for new files"
                  InputProps={{ inputProps: { min: 1 } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Connection Timeout (seconds)"
                  name="connection_timeout_seconds"
                  type="number"
                  value={sftpForm.values.connection_timeout_seconds}
                  onChange={sftpForm.handleChange}
                  InputProps={{ inputProps: { min: 5, max: 300 } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Retries"
                  name="max_retries"
                  type="number"
                  value={sftpForm.values.max_retries}
                  onChange={sftpForm.handleChange}
                  InputProps={{ inputProps: { min: 1, max: 10 } }}
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        {/* Local Folder Configuration */}
        <Collapse in={ingestionMode === "LOCAL_FOLDER"}>
          <Box
            sx={{ p: 2, border: "1px solid #e0e0e0", borderRadius: 1, mb: 2 }}
          >
            <Typography variant="subtitle1" gutterBottom>
              Local Folder Configuration
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Input Folder"
                  name="input_folder"
                  required
                  value={localForm.values.input_folder}
                  onChange={localForm.handleChange}
                  error={
                    localForm.touched.input_folder &&
                    Boolean(localForm.errors.input_folder)
                  }
                  helperText={
                    (localForm.touched.input_folder &&
                      localForm.errors.input_folder) ||
                    "Absolute path to input directory"
                  }
                  placeholder="/data/837/input"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Output Folder"
                  name="output_folder"
                  required
                  value={localForm.values.output_folder}
                  onChange={localForm.handleChange}
                  error={
                    localForm.touched.output_folder &&
                    Boolean(localForm.errors.output_folder)
                  }
                  helperText={
                    (localForm.touched.output_folder &&
                      localForm.errors.output_folder) ||
                    "Absolute path to output directory"
                  }
                  placeholder="/data/837/output"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Archive Folder (Optional)"
                  name="archive_folder"
                  value={localForm.values.archive_folder}
                  onChange={localForm.handleChange}
                  helperText="Optional folder to archive original files"
                  placeholder="/data/837/archive"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="watch_recursive"
                      checked={localForm.values.watch_recursive}
                      onChange={localForm.handleChange}
                    />
                  }
                  label="Monitor subdirectories"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Debounce (milliseconds)"
                  name="debounce_milliseconds"
                  type="number"
                  value={localForm.values.debounce_milliseconds}
                  onChange={localForm.handleChange}
                  helperText="Wait time after last file write before processing"
                  InputProps={{ inputProps: { min: 500, max: 10000 } }}
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        {/* Test Result Alert */}
        {testResult && (
          <Alert
            severity={testResult.success ? "success" : "error"}
            icon={testResult.success ? <CheckCircle /> : <ErrorIcon />}
            sx={{ mb: 2 }}
          >
            {testResult.message}
          </Alert>
        )}

        {/* Action Buttons */}
        {ingestionMode !== "REST_API" && (
          <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testingConnection || !facilityId}
              startIcon={
                testingConnection ? (
                  <CircularProgress size={16} />
                ) : (
                  <InfoIcon />
                )
              }
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </Button>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={testingConnection}
            >
              Save Configuration
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default FacilityIngestionConfig;
