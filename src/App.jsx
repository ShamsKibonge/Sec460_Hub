import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Files from "./pages/Files";
import Groups from "./pages/Groups";
import Users from "./pages/Users";
import Monitor from "./pages/Monitor";
import Logs from "./pages/Logs";
import Login from "./pages/Login";
import RequireAuth from "./auth/RequireAuth";
import Onboarding from "./pages/Onboarding";


export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                element={
                    <RequireAuth>
                        <AppLayout />
                    </RequireAuth>
                }
            >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/files" element={<Files />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/users" element={<Users />} />
                <Route path="/monitor" element={<Monitor />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/onboarding" element={<Onboarding />} />

            </Route>

            <Route path="*" element={<div className="p-6">Not found</div>} />
        </Routes>
    );
}
